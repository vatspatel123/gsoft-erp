import { getSettings, type AppSettings } from './settings'

/**
 * The bill as ESC/POS operations, for printing straight to a thermal printer.
 *
 * This is the same bill as buildBillHTML, laid out in fixed-width columns
 * instead of a table. It exists because thermal drivers cannot be trusted to
 * lay out an HTML page — see electron/escpos.js for why.
 *
 * Keep the two in step: any field added to one belongs in the other.
 */
export type PosOp = {
  a?: 'l' | 'c' | 'r'      // align
  b?: 0 | 1                // bold
  s?: 0 | 1 | 2            // 0 normal, 1 double height, 2 double height + width
  text?: string
  feed?: number
  cut?: boolean
}

/** Characters per line at font A: 48 on an 80mm head, 32 on a 58mm one. */
export const posCols = (paperSize?: string): number => (paperSize === '58mm' ? 32 : 48)

const money = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const clip = (s: any, w: number) => {
  const t = String(s ?? '')
  return t.length <= w ? t : t.slice(0, Math.max(0, w - 1)) + '.'
}

/** Left text and right text on one line, the left side giving way if it must. */
const lr = (left: string, right: string, w: number): string => {
  const r = String(right ?? '')
  const l = clip(left, Math.max(0, w - r.length - 1))
  return l + ' '.repeat(Math.max(1, w - l.length - r.length)) + r
}

const rule = (w: number, ch = '-') => ch.repeat(w)

const wrap = (s: string, w: number): string[] => {
  const words = String(s ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return []
  const out: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) line = clip(word, w)
    else if (line.length + 1 + word.length <= w) line += ' ' + word
    else { out.push(line); line = clip(word, w) }
  }
  if (line) out.push(line)
  return out
}

export function buildBillOps(saleData: any, settingsOverride?: Partial<AppSettings>): PosOp[] {
  const {
    invoiceNo, cart = [], customer,
    subtotal = 0, totalDiscount = 0, netAmount = 0,
    paymentMode, tenders, creditRemainder = 0,
    salesmanName, date, note,
  } = saleData

  const s = { ...getSettings(), ...(settingsOverride || {}) }
  const W = posCols(s.paperSize)

  const when = date ? new Date(date) : new Date()
  const valid = !isNaN(when.getTime()) ? when : new Date()
  const dateStr = valid.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = valid.toLocaleTimeString('en-IN', { hour12: false })

  const ops: PosOp[] = []
  const line = (text: string) => ops.push({ text })

  // ── Header ────────────────────────────────────────────────────────────────
  // The logo is deliberately dropped here: printing a bitmap needs the raster
  // command and doubles the job size for something a thermal head renders as a
  // grey smudge. The shop name carries the branding.
  ops.push({ a: 'c' })
  const name = (s.shopName || 'Retail ERP').toUpperCase()
  // Double width halves the columns, so only use it when the name still fits.
  ops.push({ b: 1, s: name.length <= Math.floor(W / 2) ? 2 : 1 })
  line(name)
  ops.push({ b: 0, s: 0 })

  if (s.shopTagline) line(clip(s.shopTagline, W))
  for (const l of wrap(s.shopAddress, W)) line(l)
  if (s.shopPhone) line(clip('M. ' + s.shopPhone, W))
  if (s.showGSTIN && s.gstin) line(clip('GSTIN: ' + s.gstin, W))

  ops.push({ a: 'l' })
  line(rule(W, '='))

  // ── Bill meta ─────────────────────────────────────────────────────────────
  const who = s.showCustomer && customer
    ? [customer.phone, customer.name].filter(Boolean).join(' ') : ''
  line(lr(who, 'Bill No.: ' + invoiceNo, W))
  line(lr('', 'Bill Date: ' + dateStr, W))
  line(rule(W))

  // ── Items ─────────────────────────────────────────────────────────────────
  // Two lines each: a thermal line is too narrow for seven columns side by side,
  // and splitting keeps every field the shop asked for legible.
  line(lr(' # ITEM', 'SIZE', W))
  line(lr('   BARCODE       QTY x RATE', 'AMOUNT', W))
  line(rule(W))

  cart.forEach((item: any, i: number) => {
    const p = item.product || {}
    // Category arrives as categories(name) from the POS and as `category` on a
    // reprint — accept either, exactly as the HTML bill does.
    const category = p.category || p.categories?.name || p.name || ''
    const label = [category, p.colour].filter(Boolean).join(' ')
    line(lr(String(i + 1).padStart(2) + ' ' + label.toUpperCase(), String(p.size || ''), W))
    const qtyRate = `${item.qty} x ${money(item.unit_price)}`
    line(lr('   ' + clip(p.barcode || p.batch_no || '', 14).padEnd(14) + '  ' + qtyRate,
            money(item.line_total), W))
  })

  const totalQty = cart.reduce((n: number, i: any) => n + Number(i.qty || 0), 0)
  line(rule(W))
  ops.push({ b: 1 })
  line(lr(`Total  (${totalQty} qty)`, money(subtotal), W))
  ops.push({ b: 0 })
  if (Number(totalDiscount) > 0) line(lr('Discount', '- ' + money(totalDiscount), W))

  // ── Net ───────────────────────────────────────────────────────────────────
  line(rule(W, '='))
  ops.push({ a: 'c', b: 1, s: 1 })
  line('Rs. ' + money(netAmount))
  ops.push({ a: 'l', b: 0, s: 0 })
  line(rule(W, '='))

  // ── Footer detail ─────────────────────────────────────────────────────────
  if (s.showSalesman && salesmanName) line(clip(String(salesmanName), W))
  for (const t of (s.billTerms || '').split('\n').map(x => x.trim()).filter(Boolean)) {
    for (const l of wrap('* ' + t, W)) line(l)
  }
  line('Time : ' + timeStr)

  if (s.showPaymentBreakdown) {
    const t = tenders || {}
    const entries: [string, number][] = [
      ['Cash', Number(t.cash || 0)],
      ['UPI', Number(t.upi || 0)],
      ['Card', Number(t.card || 0)],
      ['Udhar', Number(creditRemainder || 0)],
    ]
    const anySplit = entries.some(([, v]) => v > 0)
    const rows: [string, number][] = anySplit
      ? entries
      : [[String(paymentMode || 'Cash').toUpperCase(), Number(netAmount)]]
    line('')
    line('Payment Details :')
    for (const [label, val] of rows) line(lr('  ' + label, money(val), W))
  }

  if (Number(creditRemainder) > 0) {
    line('')
    ops.push({ a: 'c', b: 1 })
    line('** UDHAR / CREDIT Rs.' + money(creditRemainder) + ' **')
    const due = saleData.creditDueDate
      ? new Date(saleData.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : `${saleData.creditDueDays || 5} days`
    line('Due: ' + due)
    ops.push({ a: 'l', b: 0 })
  }

  if (note) for (const l of wrap('Note: ' + note, W)) line(l)

  ops.push({ a: 'c' })
  line('')
  line(clip(s.billFooter || 'Thank you for shopping!', W))
  ops.push({ a: 'l', feed: 3, cut: true })

  return ops
}
