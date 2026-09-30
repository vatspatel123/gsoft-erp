import toast from 'react-hot-toast'
import { getSettings, billPrintWidthMm, type AppSettings } from './settings'

export type PrintTarget = 'bill' | 'label' | 'online' | 'a4'

export interface PrintOpts {
  /** Which of the shop's printers this belongs on. Defaults to the bill printer. */
  target?: PrintTarget
  /** Stationery width in mm. Bills default to the configured paper size. */
  widthMm?: number
  /** Stationery height in mm. Omitted means "measure the content" — right for a
   *  receipt, wrong for label stock, where the page must equal the label pitch. */
  heightMm?: number
  /** Time for the document to finish drawing itself (barcode SVGs) before printing. */
  settleMs?: number
  copies?: number
}

// ─── Runaway guard ──────────────────────────────────────────────────────────
//
// A shop once got SIXTY copies of one test bill. Nothing in the code loops: they
// were sixty separate presses. Silent printing shows the cashier nothing, so a
// press that appears to do nothing gets pressed again, and Windows holds every
// job for a printer that is erroring until it recovers — then prints the lot.
//
// The guard lives here because this is the single module every screen prints
// through, so one lock covers bills, labels, reprints, purchase entry and
// wholesale rather than six separate fixes.

const inFlight = new Map<PrintTarget, number>()
const lastJob = new Map<PrintTarget, { sig: string; at: number }>()

const REPEAT_MS = 4000    // an identical document inside this window is a double-press
const STALE_MS = 60000    // a job that never reported back must not jam printing forever

/** Cheap fingerprint of a document, enough to tell a repeat from a new bill. */
const sigOf = (content: string): string =>
  content.length + ':' + content.slice(0, 120) + content.slice(-60)

function claim(target: PrintTarget, sig: string): boolean {
  const now = Date.now()

  const started = inFlight.get(target)
  if (started !== undefined && now - started < STALE_MS) {
    toast('Still printing — one moment', { icon: '🖨️' })
    return false
  }

  const prev = lastJob.get(target)
  if (prev && prev.sig === sig && now - prev.at < REPEAT_MS) {
    toast('Already sent to the printer', { icon: '✅' })
    return false
  }

  inFlight.set(target, now)
  lastJob.set(target, { sig, at: now })
  return true
}

const release = (target: PrintTarget) => { inFlight.delete(target) }

const LABEL: Record<PrintTarget, string> = {
  bill: 'Receipt', label: 'Barcode label', online: 'Shipping label', a4: 'A4 document',
}

const deviceFor = (target: PrintTarget): string => {
  const s = getSettings()
  if (target === 'label') return s.barcodePrinter || ''
  if (target === 'online') return s.onlineLabelPrinter || ''
  if (target === 'a4') return s.a4Printer || ''
  return s.billPrinter || ''
}

/**
 * Print a standalone HTML document.
 *
 * Desktop: hands the document straight to the named printer, so a shop with a
 * receipt printer, a barcode printer and a label printer never has to pick one
 * from a dialog. Browser: falls back to the OS print dialog.
 */
export async function printHTML(html: string, opts: PrintOpts = {}): Promise<void> {
  const target = opts.target ?? 'bill'
  const widthMm = opts.widthMm ?? (target === 'bill' ? billPrintWidthMm() : 0)
  const printing = window.electronAPI?.printing

  if (!claim(target, sigOf(html))) return

  if (printing) {
    const deviceName = deviceFor(target)
    // Silent printing is invisible by design, so say what is happening. Without
    // this the cashier has no way to tell a working printer from a dead one.
    const note = toast.loading(`${LABEL[target]} → ${deviceName || 'print dialog'}`)
    try {
      // A receipt on a thermal printer is drawn as dots by the app and sent RAW.
      // Letting the Windows driver lay it out is what printed blank bills on the
      // shop's RP326 — see electron/raster.js. Covers every receipt-shaped
      // document at once: bills, exchange slips, credit notes.
      const thermal = target === 'bill' && !!deviceName && getSettings().paperSize !== 'A4'
      if (thermal && printing.rasterBill) {
        const res = await printing.rasterBill({ deviceName, html, widthMm })
        toast.dismiss(note)
        if (res?.ok) { toast.success('Receipt printed', { duration: 2000 }); return }
        // Never fall back to the driver's silent print: that is the blank-paper
        // route. The dialog at least lets the cashier see and choose.
        toast.error(`Receipt printer: ${res?.reason || 'failed'} — opening the print dialog`)
        await printing.print({ html, deviceName: '', widthMm, settleMs: opts.settleMs ?? 250 })
        return
      }

      // Width drives a CSS @page rule on the desktop side. (The Electron pageSize
      // option is a different thing and renders blank — do not use it.)
      const res = await printing.print({
        html, deviceName, widthMm, heightMm: opts.heightMm ?? 0,
        settleMs: opts.settleMs ?? 250,
        copies: opts.copies ?? 1,
      })
      toast.dismiss(note)
      if (res?.ok) toast.success(`${LABEL[target]} sent`, { duration: 2000 })
      else if (res?.reason && !/cancel/i.test(res.reason)) {
        toast.error(`Printing failed: ${res.reason}`)
      }
    } catch (e: any) {
      toast.dismiss(note)
      toast.error(`Printing failed: ${e?.message || 'unknown error'}`)
    } finally {
      release(target)
    }
    return
  }

  try { browserPrint(html, widthMm, opts.settleMs ?? 250) }
  finally { release(target) }
}

/**
 * Browser fallback.
 *
 * The frame must be laid out at its real size and must NOT be visibility:hidden
 * — a hidden frame renders nothing, which is exactly how this printed blank
 * pages. Moving it off-screen keeps it invisible while still rendering.
 */
function browserPrint(html: string, widthMm: number, settleMs: number): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    `position:fixed;left:-10000px;top:0;border:0;background:#fff;` +
    `width:${widthMm > 0 ? widthMm + 'mm' : '210mm'};height:297mm;`

  const drop = () => { if (frame.isConnected) frame.remove() }

  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) { drop(); return }
    setTimeout(() => {
      try {
        win.onafterprint = () => setTimeout(drop, 500)
        win.focus()
        win.print()
      } catch (e) {
        console.warn('Print failed:', e)
        drop()
      }
    }, settleMs)
  }

  setTimeout(drop, 120000)   // never leave the frame in the DOM
  document.body.appendChild(frame)
  frame.srcdoc = html
}

/** Printers Windows can see. Empty in the browser build. */
export async function listPrinters(): Promise<
  { name: string; displayName: string; isDefault: boolean }[]
> {
  try { return (await window.electronAPI?.printing?.list()) || [] }
  catch { return [] }
}

export const canSelectPrinters = () => !!window.electronAPI?.printing

/**
 * Send an already-laid-out receipt to the thermal printer as raw ESC/POS bytes.
 * Returns the failure reason so the caller can fall back to the HTML path.
 */
/** Remove everything stuck in the queue for the shop's printers. */
export async function clearPrintQueues(): Promise<{ removed: number; reason?: string }> {
  const api = window.electronAPI?.printing?.clearQueue
  if (!api) return { removed: 0, reason: 'Needs the desktop app' }
  const s = getSettings()
  const names = [...new Set([s.billPrinter, s.barcodePrinter, s.onlineLabelPrinter].filter(Boolean))]
  if (!names.length) return { removed: 0, reason: 'No printers selected yet' }
  try { return await api(names) }
  catch (e: any) { return { removed: 0, reason: e?.message || 'Could not reach the print queue' } }
}

/** How many jobs are waiting on the shop's printers right now. */
export async function pendingJobs(): Promise<number> {
  const api = window.electronAPI?.printing?.queueCount
  if (!api) return 0
  const s = getSettings()
  const names = [...new Set([s.billPrinter, s.barcodePrinter, s.onlineLabelPrinter].filter(Boolean))]
  if (!names.length) return 0
  try { return (await api(names))?.count ?? 0 } catch { return 0 }
}

// ─── Automatic printer setup ────────────────────────────────────────────────
//
// The shop should not have to know which Windows device name is which machine.
// Printer models are recognisable from their names, so match them and assign.

/** Windows ships these; they are not shop hardware and must never be picked. */
const VIRTUAL = /microsoft (print to pdf|xps)|xps document writer|onenote|\bfax\b|adobe pdf|pdf24|cutepdf|foxit|\bsnagit\b|send to/i

// Checked FIRST: an "XP-470B" is a label printer while an "XP-80" is a receipt
// printer, so the label patterns have to win before the generic ones run.
const LABEL_RE = /\b(tsc|tvs\s*lp|zebra|godex|argox|sewoo lk-?b|label|barcode|zd\d|gc\d{3}|te\d{3}|xp-?4\d\d|dt2)\b/i

const BILL_RE = /\b(rp\s*-?326|rp\s*-?\d{3}|rugtek|pos\s*-?80|pos\s*-?58|tm\s*-?t\d|epson tm|thermal|receipt|ep-?80|3nstar|everycom|retsol|hoin|bill|80mm|58mm)\b/i

const hay = (p: { name: string; displayName: string }) => `${p.name} ${p.displayName}`

/**
 * Work out which printer is which and return the settings patch.
 * Nothing is guessed away: a printer already chosen by hand is left alone
 * unless `force` is set.
 */
export async function autoAssignPrinters(
  opts: { force?: boolean } = {}
): Promise<{ patch: Partial<AppSettings>; found: number }> {
  const all = await listPrinters()
  const real = all.filter(p => !VIRTUAL.test(hay(p)))
  if (!real.length) return { patch: {}, found: all.length }

  const s = getSettings()
  const keep = (k: 'billPrinter' | 'barcodePrinter' | 'onlineLabelPrinter') =>
    !opts.force && s[k] && real.some(p => p.name === s[k]) ? s[k] : ''

  const patch: Partial<AppSettings> = {}

  const label = keep('barcodePrinter') || real.find(p => LABEL_RE.test(hay(p)))?.name || ''
  if (label) patch.barcodePrinter = label

  // The receipt printer: by model name, else the Windows default, else whatever
  // real printer is left that is not the label printer.
  const bill = keep('billPrinter')
    || real.find(p => BILL_RE.test(hay(p)) && p.name !== label)?.name
    || real.find(p => p.isDefault && p.name !== label)?.name
    || real.find(p => p.name !== label)?.name
    || ''
  if (bill) patch.billPrinter = bill

  // Third machine if the shop has one; otherwise online labels share the barcode
  // printer, which is what a two-printer shop wants anyway.
  const online = keep('onlineLabelPrinter')
    || real.find(p => p.name !== bill && p.name !== label)?.name
    || label || ''
  if (online) patch.onlineLabelPrinter = online

  return { patch, found: real.length }
}

/**
 * Send a raw printer program (TSPL for a TSC label printer) to one of the
 * shop's printers. Carries the same runaway guard as every other print path.
 */
export async function printRawText(
  target: PrintTarget, text: string
): Promise<{ ok: boolean; reason?: string }> {
  const api = window.electronAPI?.printing?.rawText
  if (!api) return { ok: false, reason: 'Raw printing needs the desktop app' }
  if (!claim(target, sigOf(text))) return { ok: true, reason: 'duplicate' }

  const device = deviceFor(target)
  const note = toast.loading(`${LABEL[target]} → ${device}`)
  try {
    const res = await api({ deviceName: device, text })
    toast.dismiss(note)
    if (res?.ok) toast.success(`${LABEL[target]} sent`, { duration: 2000 })
    return res
  } catch (e: any) {
    toast.dismiss(note)
    return { ok: false, reason: e?.message || 'Raw print failed' }
  } finally {
    release(target)
  }
}

/** True when barcode labels should go out as TSPL rather than rendered HTML. */
export const useRawLabels = (): boolean => {
  const s = getSettings()
  return !!window.electronAPI?.printing?.rawText && s.rawLabels !== false && !!s.barcodePrinter
}

/** Designed labels, drawn to dots by the app and placed on the roll in TSPL. */
export async function printRasterLabels(
  labelHtmls: string[], geometry: unknown
): Promise<{ ok: boolean; reason?: string }> {
  const api = window.electronAPI?.printing?.rasterLabels
  if (!api) return { ok: false, reason: 'Needs the desktop app' }
  if (!claim('label', sigOf(labelHtmls.join('|')))) return { ok: true, reason: 'duplicate' }

  const device = deviceFor('label')
  const note = toast.loading(`Barcode label → ${device}`)
  try {
    const res = await api({ deviceName: device, labels: labelHtmls, geometry })
    toast.dismiss(note)
    if (res?.ok) toast.success(`${labelHtmls.length} label${labelHtmls.length === 1 ? '' : 's'} sent`, { duration: 2000 })
    return res
  } catch (e: any) {
    toast.dismiss(note)
    return { ok: false, reason: e?.message || 'Label print failed' }
  } finally {
    release('label')
  }
}
