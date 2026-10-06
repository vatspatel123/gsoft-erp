// Printing for the desktop app.
//
// A shop with a receipt printer, a barcode printer and a label printer should
// never pick from a dialog. Electron can address a printer by name, so each kind
// of document goes straight to its own machine.
//
// Two things here were established by testing and must not be "tidied":
//
//  1. ONE reused hidden window. Creating and destroying a BrowserWindow per print
//     makes the SECOND print fail with ERR_FAILED — the shop's first bill prints
//     and nothing after it does.
//
//  2. NO Electron pageSize option. Passing pageSize {width,height} in microns
//     renders a completely blank page. The page size is set through CSS instead
//     (a valid two-length @page) with preferCSSPageSize, which Chromium honours.
//     Without it the job goes out at the printer's default paper — Letter — and
//     a thermal printer spits out blank strips.

const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs = require('fs')

let printWin = null
let seq = 0

// One shared window means two prints fired close together would race: the second
// document loads over the first before it has been sent, so a bill can come out
// of the label printer. Every job therefore waits its turn.
let queue = Promise.resolve()

function getPrintWindow() {
  if (printWin && !printWin.isDestroyed()) return printWin
  printWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: false, backgroundThrottling: false },
  })
  printWin.on('closed', () => { printWin = null })
  return printWin
}

async function listPrinters() {
  const w = getPrintWindow()
  const printers = await w.webContents.getPrintersAsync()
  return printers.map(p => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: !!p.isDefault,
    status: p.status,
  }))
}

/**
 * Render HTML and send it to a named printer.
 * With no deviceName the system print dialog opens instead, so the shop can
 * still print before it has assigned its printers.
 */
function printHTML(html, opts = {}) {
  const job = queue.then(() => runPrint(html, opts), () => runPrint(html, opts))
  // keep the chain alive even if one job rejects
  queue = job.catch(() => {})
  return job
}

async function runPrint(html, opts = {}) {
  const { deviceName = '', settleMs = 250, copies = 1, widthMm = 0, heightMm = 0 } = opts

  const file = path.join(app.getPath('temp'), `erp-print-${Date.now()}-${++seq}.html`)
  fs.writeFileSync(file, html, 'utf8')

  try {
    const w = getPrintWindow()
    await w.loadFile(file)
    // Barcode labels draw their own SVGs after load; give them a moment.
    await new Promise(r => setTimeout(r, settleMs))

    const printOpts = {
      silent: !!deviceName,
      printBackground: true,
      // Ceiling, not just a floor. Nothing in the app asks for more than one
      // copy, so a large number here means something upstream went wrong — and
      // the paper cost of finding out is sixty bills on the floor.
      copies: Math.min(5, Math.max(1, Number(copies) || 1)),
      margins: { marginType: 'none' },
    }

    // Size the page to the stationery and to the content's own length, so a
    // receipt roll advances exactly as far as the bill is long. Note `size`
    // needs TWO lengths — "80mm auto" is invalid CSS and is silently dropped,
    // which is how jobs ended up on Letter paper.
    if (widthMm > 0) {
      // Label stock has a fixed pitch; a receipt's length is whatever it is.
      // Measuring content for label stock is what drifted the roll.
      const measured = heightMm > 0 ? heightMm : await w.webContents.executeJavaScript(`
        (() => {
          // BODY only. documentElement.scrollHeight is at least the window's
          // viewport height, so taking the max sized a 25mm label at 153mm and
          // fed six label rows for one sticker.
          const px = Math.ceil(document.body.getBoundingClientRect().height) || document.body.scrollHeight;
          const mm = Math.ceil(px * 25.4 / 96) + 2;
          const el = document.createElement('style');
          el.textContent = '@page { size: ${widthMm}mm ' + mm + 'mm; margin: 0; }';
          document.head.appendChild(el);
          return mm;
        })()
      `).catch(() => 0)
      if (heightMm > 0) {
        await w.webContents.executeJavaScript(
          `(() => { const el = document.createElement('style');
             el.textContent = '@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }';
             document.head.appendChild(el); })()`).catch(() => {})
      }
      if (measured) printOpts.preferCSSPageSize = true
    }
    if (deviceName) printOpts.deviceName = deviceName

    return await new Promise((resolve) => {
      w.webContents.print(printOpts, (success, failureReason) =>
        resolve({ ok: !!success, reason: failureReason || '' }))
    })
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Print failed' }
  } finally {
    fs.promises.unlink(file).catch(() => {})
  }
}

/** Render HTML to a PDF buffer, for sending a bill on WhatsApp. */
async function renderPDF(html, widthMm = 80) {
  const job = queue.then(() => runRender(html, widthMm), () => runRender(html, widthMm))
  queue = job.catch(() => {})
  return job
}

async function runRender(html, widthMm) {
  const file = path.join(app.getPath('temp'), `erp-pdf-${Date.now()}-${++seq}.html`)
  fs.writeFileSync(file, html, 'utf8')
  try {
    const w = getPrintWindow()
    await w.loadFile(file)
    await new Promise(r => setTimeout(r, 250))
    if (widthMm > 0) {
      await w.webContents.executeJavaScript(`
        (() => { const px = Math.ceil(document.body.getBoundingClientRect().height) || document.body.scrollHeight;
          const mm = Math.ceil(px * 25.4 / 96) + 2;
          const el = document.createElement('style');
          el.textContent = '@page { size: ${widthMm}mm ' + mm + 'mm; margin: 0; }';
          document.head.appendChild(el); return mm; })()`).catch(() => {})
    }
    // A page that sets its own size (an A4 e-way bill passes widthMm 0) keeps it.
    const pdf = await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
    return { ok: true, base64: Buffer.from(pdf).toString('base64') }
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'Could not build the PDF' }
  } finally {
    fs.promises.unlink(file).catch(() => {})
  }
}

module.exports = { listPrinters, printHTML, renderPDF }
