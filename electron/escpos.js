// Raw ESC/POS printing for thermal receipt printers (Rugtek RP326, POS-80, ...).
//
// WHY RAW INSTEAD OF RENDERING HTML
// A thermal printer has no page. Its Windows driver exposes a fake paper form,
// and asking Chromium for an 80mm x N page and letting that driver lay it out is
// what produced blank strips on the shop's RP326 — whatever @page said. ESC/POS
// bytes go through the spooler untouched, which is how every POS on the market
// drives these printers. There is nothing left for the shop to configure.
//
// The HTML path is still used for A4 and for label printers (those speak TSPL,
// not ESC/POS), and stays as the fallback if a raw write fails.

const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const ESC = 0x1b, GS = 0x1d

const CMD = {
  init:  [ESC, 0x40],
  align: n => [ESC, 0x61, n],                                  // 0 left, 1 centre, 2 right
  bold:  n => [ESC, 0x45, n ? 1 : 0],
  // GS ! n — low nibble is height magnification, high nibble is width.
  size:  n => [GS, 0x21, n === 2 ? 0x11 : n === 1 ? 0x01 : 0x00],
  feed:  n => [ESC, 0x64, Math.max(0, Math.min(255, n | 0))],
  cut:   [GS, 0x56, 0x42, 0x00],                               // partial cut, feed first
}

// A thermal head has no rupee glyph and no smart quotes. Anything outside plain
// ASCII prints as garbage, so fold it down rather than let the shop see mojibake.
const ascii = (s) => String(s == null ? '' : s)
  .replace(/₹/g, 'Rs.')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/[^\x20-\x7e\n]/g, '')

/**
 * Turn the renderer's op list into printer bytes.
 * Ops: { a:'l'|'c'|'r', b:0|1, s:0|1|2, text:string, feed:n, cut:true }
 */
function encode(ops) {
  const parts = [Buffer.from(CMD.init)]
  const push = (a) => parts.push(Buffer.from(a))

  for (const op of ops || []) {
    if (op.a !== undefined) push(CMD.align(op.a === 'c' ? 1 : op.a === 'r' ? 2 : 0))
    if (op.b !== undefined) push(CMD.bold(op.b))
    if (op.s !== undefined) push(CMD.size(op.s))
    if (op.text !== undefined) parts.push(Buffer.from(ascii(op.text) + '\n', 'latin1'))
    if (op.feed) push(CMD.feed(op.feed))
    if (op.cut) push(Buffer.from(CMD.cut))
  }
  // Always leave the paper past the tear bar even if the caller forgot.
  parts.push(Buffer.from(CMD.feed(3)))
  return Buffer.concat(parts)
}

// Writes bytes straight to the print spooler as a RAW job. P/Invoke through
// PowerShell rather than a native module: every Windows 10/11 has it, and a
// native addon would have to be rebuilt for each Electron version.
const PS_SCRIPT = `param([Parameter(Mandatory=$true)][string]$Printer,[Parameter(Mandatory=$true)][string]$Path)
$src = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr buf, int count, out int written);

  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero))
      throw new Exception("Windows will not open the printer '" + printer + "' (error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "Retail ERP Receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("The printer refused the job (StartDocPrinter)");
      try {
        if (!StartPagePrinter(h)) throw new Exception("The printer refused the job (StartPagePrinter)");
        // Windows may take only part of a write. A long label run is about 1 MB,
        // and the part it didn't take used to be dropped without a word, losing
        // labels mid-roll. Send in pieces and keep going until every byte is in.
        const int CHUNK = 65536;
        IntPtr p = Marshal.AllocCoTaskMem(CHUNK);
        try {
          int sent = 0;
          while (sent < bytes.Length) {
            int n = Math.Min(CHUNK, bytes.Length - sent);
            Marshal.Copy(bytes, sent, p, n);
            int written;
            if (!WritePrinter(h, p, n, out written))
              throw new Exception("Could not write to the printer (error " + Marshal.GetLastWin32Error() + ")");
            if (written <= 0)
              throw new Exception("The printer stopped accepting data after " + sent + " of " + bytes.Length + " bytes");
            // Only part of this piece went in: send the rest of it next.
            sent += written;
          }
        } finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@
Add-Type -TypeDefinition $src -Language CSharp
[RawPrinter]::Send($Printer, [System.IO.File]::ReadAllBytes($Path))
Write-Output "OK"
`

let scriptPath = null
function psScript() {
  if (scriptPath && fs.existsSync(scriptPath)) return scriptPath
  // Written out at runtime: PowerShell cannot read a file inside app.asar.
  scriptPath = path.join(os.tmpdir(), 'erp-rawprint.ps1')
  fs.writeFileSync(scriptPath, PS_SCRIPT, 'utf8')
  return scriptPath
}

/**
 * Push bytes at a named Windows printer as a RAW job.
 * Receipts send ESC/POS through here; TSC label printers send TSPL. Neither
 * involves a driver laying out a page, which is the whole point.
 */
function sendBytes(deviceName, buf) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32')
      return resolve({ ok: false, reason: 'Raw printing needs Windows' })
    if (!deviceName)
      return resolve({ ok: false, reason: 'No printer selected' })

    let bin
    try {
      bin = path.join(os.tmpdir(), `erp-raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`)
      fs.writeFileSync(bin, buf)
    } catch (e) {
      return resolve({ ok: false, reason: (e && e.message) || 'Could not prepare the job' })
    }

    // ponytail: Add-Type recompiles on every call (~1s). Fine for one bill at a
    // time; if a shop ever batch-prints, keep a PowerShell process alive instead.
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
       '-File', psScript(), '-Printer', deviceName, '-Path', bin],
      { timeout: 30000, windowsHide: true },
      (err, stdout, stderr) => {
        fs.promises.unlink(bin).catch(() => {})
        if (err || !/OK/.test(String(stdout))) {
          const detail = String(stderr || (err && err.message) || '').split('\n')
            .map(l => l.trim()).filter(Boolean)[0] || 'Raw print failed'
          return resolve({ ok: false, reason: detail })
        }
        resolve({ ok: true })
      }
    )
  })
}

/** A receipt, as ESC/POS. */
const printRaw = (deviceName, ops) => sendBytes(deviceName, encode(ops))

/** A label program, as TSPL. Latin-1: TSPL is byte-oriented, not UTF-8. */
const printRawString = (deviceName, text) =>
  sendBytes(deviceName, Buffer.from(String(text == null ? '' : text), 'latin1'))

module.exports = { printRaw, printRawString, sendBytes, encode }

// ─── Print queue ────────────────────────────────────────────────────────────
//
// Windows holds jobs for a printer that is offline or erroring, then prints the
// whole backlog the moment it recovers. That is how a shop got sixty copies of
// one test bill after an update. These let the shop see the backlog and clear it
// instead of discovering it on paper.

const QUEUE_SCRIPT = `param([Parameter(Mandatory=$true)][string]$Printers,[switch]$Remove)
$total = 0
foreach($name in ($Printers -split ';;')){
  if([string]::IsNullOrWhiteSpace($name)){ continue }
  try{
    $jobs = @(Get-PrintJob -PrinterName $name -ErrorAction Stop)
    $total += $jobs.Count
    if($Remove -and $jobs.Count -gt 0){ $jobs | Remove-PrintJob -ErrorAction SilentlyContinue }
  } catch { }
}
Write-Output "COUNT=$total"
`

let queuePath = null
function queueScript() {
  if (queuePath && fs.existsSync(queuePath)) return queuePath
  queuePath = path.join(os.tmpdir(), 'erp-printqueue.ps1')
  fs.writeFileSync(queuePath, QUEUE_SCRIPT, 'utf8')
  return queuePath
}

function queueOp(printerNames, remove) {
  return new Promise((resolve) => {
    const names = (printerNames || []).filter(Boolean)
    if (process.platform !== 'win32' || !names.length) return resolve({ count: 0, removed: 0 })

    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                  '-File', queueScript(), '-Printers', names.join(';;')]
    if (remove) args.push('-Remove')

    execFile('powershell.exe', args, { timeout: 20000, windowsHide: true }, (err, stdout) => {
      const m = /COUNT=(\d+)/.exec(String(stdout || ''))
      const n = m ? Number(m[1]) : 0
      if (err && !m) return resolve({ count: 0, removed: 0, reason: 'Could not read the print queue' })
      resolve(remove ? { removed: n, count: 0 } : { count: n, removed: 0 })
    })
  })
}

const queueCount = (names) => queueOp(names, false)
const clearQueue = (names) => queueOp(names, true)

module.exports.queueCount = queueCount
module.exports.clearQueue = clearQueue
