import type { GstType } from '../hooks/useWholesale'
import { getSettings } from './settings'
import { sendWhatsApp } from './whatsapp'
import { printHTML } from './printHTML'
import { fmtDateTime } from './date'
import { rupeesInWords } from './numberWords'

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const amt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2)
const inr = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Lines per half-page sheet, as on the shop's Logic invoice. */
const ROWS_PER_PAGE = 8

/**
 * The wholesale tax invoice, laid out like the shop's Logic "Debit Memo":
 * a framed half-page (A5 landscape) sheet, 8 lines a page with C/F and B/F
 * between pages, GST split by rate, amounts in words, bank details and terms.
 */
export function buildWholesaleBillHTML(saleData: any): string {
  const s = getSettings()
  const { party, cart = [], subtotal, discountPct, billDiscAmt, freight,
    gstType, gstAmount, roundOff, netAmount, invoiceNo, date, paymentMode, notes } = saleData
  const isIGST = (gstType as GstType) === 'igst'
  const disc = 1 - (Number(discountPct) || 0) / 100

  const lines = cart.map((item: any, i: number) => ({
    no: i + 1,
    name: item.product?.name || 'Product',
    hsn: item.product?.hsn_code || '',
    qty: Number(item.qty) || 0,
    rate: Number(item.unit_price) || 0,
    lineDisc: Number(item.discount_pct) || 0,
    gst: Number(item.gst_rate) || 0,
    amount: (Number(item.qty) || 0) * (Number(item.unit_price) || 0) * (1 - (Number(item.discount_pct) || 0) / 100),
  }))
  const anyLineDisc = lines.some((l: any) => l.lineDisc > 0)

  // GST by rate, on the value after the bill discount (the invoice's taxable value).
  const byRate = new Map<number, { taxable: number; tax: number }>()
  for (const l of lines) {
    const e = byRate.get(l.gst) || { taxable: 0, tax: 0 }
    e.taxable += l.amount * disc; e.tax += l.amount * disc * l.gst / 100
    byRate.set(l.gst, e)
  }
  const taxable = (Number(subtotal) || 0) - (Number(billDiscAmt) || 0)
  const totalGst = Number(gstAmount) || 0
  const taxRows = [...byRate.entries()].sort((x, y) => x[0] - y[0]).flatMap(([rate, e]) =>
    rate === 0 ? [] : isIGST
      ? [['Integrated Tax', `${amt(rate)}%`, e.tax]]
      : [['Central Tax', `${amt(rate / 2)}%`, e.tax / 2], ['State/UT Tax', `${amt(rate / 2)}%`, e.tax / 2]])

  const stateNo = Number(String(party?.gstin || '').slice(0, 2)) || (s.gstin ? Number(String(s.gstin).slice(0, 2)) : 0)
  const placeOfSupply = `${stateNo ? String(stateNo).padStart(2, '0') + '-' : ''}${esc(party?.state || s.state || '')}`
  const memo = paymentMode === 'credit' ? 'Debit Memo' : 'Cash Memo'
  const terms = String(s.wholesaleTerms || '').split('\n').map(t => t.trim()).filter(Boolean)
  const billDate = (() => { const d = String(date || '').match(/^(\d{2})-(\d{2})-(\d{4})/); return d ? `${d[1]}/${d[2]}/${d[3]}` : esc(date) })()

  const pages: any[][] = []
  for (let i = 0; i < Math.max(1, lines.length); i += ROWS_PER_PAGE) pages.push(lines.slice(i, i + ROWS_PER_PAGE))
  let carried = 0

  const page = (rows: any[], pi: number) => {
    const last = pi === pages.length - 1
    const bf = carried
    carried += rows.reduce((t: number, l: any) => t + l.amount, 0)
    const body = rows.map((l: any) => `<tr>
        <td class="c">${l.no}</td><td>${esc(l.name)}</td><td class="c">${esc(l.hsn)}</td>
        <td class="n">${l.qty.toFixed(3)}</td><td class="n">${amt(l.rate)}</td>
        ${anyLineDisc ? `<td class="n">${l.lineDisc ? amt(l.lineDisc) : ''}</td>` : ''}
        <td class="n">${amt(l.gst)}</td><td class="n">${amt(l.amount)}</td></tr>`).join('')
    const right = last ? `
        ${Number(billDiscAmt) > 0 ? `<div class="kv"><span>Less: Discount${Number(discountPct) ? ` ${amt(discountPct)}%` : ''}</span><span>${amt(billDiscAmt)}</span></div>` : ''}
        <div class="kv"><span>Taxable Amount</span><span>${amt(taxable)}</span></div>
        ${taxRows.map(([k, r, v]) => `<div class="kv"><span>${k}</span><span class="r">${r}</span><span>${amt(v as number)}</span></div>`).join('')}
        ${Number(freight) > 0 ? `<div class="kv"><span>Freight</span><span>${amt(freight)}</span></div>` : ''}
        <div class="kv"><span>Round Off</span><span>${amt(roundOff)}</span></div>
        <div class="grand"><span>Grand Total</span><span>${inr(netAmount)}</span></div>`
      : `<div class="cf">C/F to Next page</div>`
    return `<div class="sheet">
  <div class="head">
    <div class="shop">${esc(s.shopName || '')}</div>
    <div class="addr">${esc(s.shopAddress || '')}</div>
    ${s.shopPhone ? `<div class="addr">M. ${esc(s.shopPhone)}</div>` : ''}
  </div>
  <div class="bar"><span>${memo}</span><span class="title">TAX INVOICE</span><span>Original</span></div>
  <div class="party">
    <div class="to">
      <div><span class="lbl">M/s. :</span> <b class="pname">${esc(party?.business_name || party?.name || '')}</b></div>
      ${party?.address ? `<div class="pad">${esc(party.address)}</div>` : ''}
      ${party?.city || party?.pincode ? `<div class="pad">${esc(party?.city || '')}${party?.pincode ? ' - ' + esc(party.pincode) : ''}</div>` : ''}
      <div><span class="lbl">Place of Supply :</span> ${placeOfSupply}</div>
      <div><span class="lbl">GSTIN No.</span> <span class="lbl">:</span>${esc(party?.gstin || '')}</div>
    </div>
    <div class="inv">
      <div class="invtop"><div><b>Invoice No.</b><b>: ${esc(invoiceNo)}</b></div><div><b>Date</b><b>: ${billDate}</b></div></div>
      ${pages.length > 1 ? `<div class="pg">Page ${pi + 1} of ${pages.length}</div>` : ''}
    </div>
  </div>
  <table>
    <colgroup><col style="width:6%"><col><col style="width:9%"><col style="width:10%"><col style="width:10%">
      ${anyLineDisc ? '<col style="width:7%">' : ''}<col style="width:7%"><col style="width:13%"></colgroup>
    <thead><tr><th>SrNo</th><th>Product Name</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th>${anyLineDisc ? '<th>Disc %</th>' : ''}<th>GST %</th><th>Amount</th></tr></thead>
    <tbody>
      ${pi > 0 ? `<tr><td></td><td></td><td></td><td></td><td></td>${anyLineDisc ? '<td></td>' : ''}<td class="n">B/F-&gt;</td><td class="n">${amt(bf)}</td></tr>` : ''}
      ${body}
      <tr class="fill"><td></td><td></td><td></td><td></td><td></td>${anyLineDisc ? '<td></td>' : ''}<td></td><td></td></tr>
    </tbody>
  </table>
  <div class="foot">
    <div class="left">
      <div class="gst"><span class="lbl">GSTIN No.:</span> <b>${esc(s.gstin || '')}</b></div>
      <div class="bank">
        <div>${s.bankName ? `<b>Bank Name</b> : ${esc(s.bankName)}` : ''}</div>
        <div>${s.bankAccount ? `<b>Bank A/c. No.</b> : ${esc(s.bankAccount)}` : ''}</div>
        <div>${s.bankIfsc ? `<b>RTGS/IFSC Code</b> : ${esc(s.bankIfsc)}` : ''}</div>
        <div class="note"><span class="lbl">Note :</span> ${esc(notes || '')}</div>
      </div>
      <div class="words"><span class="lbl">Total GST :</span> ${last ? esc(rupeesInWords(totalGst)) : ''}</div>
      <div class="words"><span class="lbl">Bill Amount :</span> ${last ? esc(rupeesInWords(Number(netAmount) || 0)) : ''}</div>
    </div>
    <div class="right">
      <div class="sub"><span>Sub Total</span><span>${amt(carried)}</span></div>
      <div class="tot">${right}</div>
    </div>
  </div>
  <div class="terms">
    <div class="tl"><span class="lbl">Terms &amp; Condition :</span>
      ${terms.map((t, i) => `<div>${i + 1}. ${esc(t)}</div>`).join('')}</div>
    <div class="sign"><div>For, ${esc(s.shopName || '')}</div><div class="auth">(Authorised Signatory)</div></div>
  </div>
</div>`
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tax Invoice ${esc(invoiceNo)}</title><style>
  @page { size: 210mm 148mm; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #000; }
  .sheet { height: 137mm; border: 1px solid #000; display: flex; flex-direction: column; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .lbl { font-size: 9px; }
  .head { text-align: center; padding: 3px 0 2px; border-bottom: 1px solid #000; }
  .shop { font-family: 'Times New Roman', Times, serif; font-size: 22px; font-weight: 700; letter-spacing: .5px; }
  .addr { font-family: 'Times New Roman', Times, serif; font-size: 10.5px; }
  .bar { display: flex; justify-content: space-between; padding: 1px 4px; border-bottom: 1px solid #000; font-size: 10px; }
  .bar .title { font-size: 11px; letter-spacing: 1px; }
  .party { display: grid; grid-template-columns: 1fr 39%; border-bottom: 1px solid #000; }
  .to { padding: 2px 6px; line-height: 1.45; border-right: 1px solid #000; }
  .pname { font-size: 12px; font-weight: 400; } .pad { padding-left: 52px; }
  .invtop { background: #e5e5e5; padding: 3px 6px; border-bottom: 1px solid #000; font-family: 'Times New Roman', serif; font-size: 11px; line-height: 1.5; }
  .invtop div { display: grid; grid-template-columns: 80px 1fr; }
  .pg { padding: 3px 6px; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; flex: 1; }
  th { font-weight: 400; font-size: 9.5px; border-bottom: 1px solid #000; padding: 2px 3px; text-align: center; }
  th + th, td + td { border-left: 1px solid #000; }
  td { padding: 0 4px; line-height: 1.3; vertical-align: top; }
  td.n { text-align: right; } td.c { text-align: center; }
  tr.fill td { height: 100%; }
  .foot { display: grid; grid-template-columns: 1fr 30%; border-top: 1px solid #000; }
  .left { border-right: 1px solid #000; display: flex; flex-direction: column; }
  .gst { background: #e5e5e5; padding: 2px 6px; border-bottom: 1px solid #000; }
  .bank { padding: 2px 6px; font-family: 'Times New Roman', serif; font-size: 10px; line-height: 1.4; border-bottom: 1px solid #000; position: relative; min-height: 46px; }
  .bank .note { position: absolute; left: 52%; top: 2px; font-family: Arial, sans-serif; font-size: 9px; }
  .words { padding: 3px 6px; border-bottom: 1px solid #000; min-height: 18px; }
  .words:last-child { border-bottom: 0; }
  .right { display: flex; flex-direction: column; }
  .sub { display: flex; justify-content: space-between; padding: 2px 4px; border-bottom: 1px solid #000; background: #e5e5e5; }
  .tot { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 2px 4px; line-height: 1.35; }
  .kv { display: grid; grid-template-columns: 1fr auto 70px; gap: 6px; } .kv span:last-child, .kv .r { text-align: right; }
  .kv span:first-child { grid-column: 1; }
  .grand { display: flex; justify-content: space-between; border-top: 1px solid #000; margin: 2px -4px -2px; padding: 3px 4px; font-size: 12px; background: #e5e5e5; }
  .cf { margin-top: auto; padding-bottom: 2px; }
  .terms { display: flex; justify-content: space-between; border-top: 1px solid #000; padding: 2px 6px; font-size: 8.5px; line-height: 1.35; }
  .sign { text-align: right; display: flex; flex-direction: column; justify-content: space-between; font-size: 9.5px; }
  .auth { font-size: 9px; }
</style></head><body>${pages.map(page).join('')}</body></html>`
}

export function printWholesaleBill(saleData: any) {
  // A4/A5 office printer, not the receipt roll.
  printHTML(buildWholesaleBillHTML(saleData), { target: 'a4', widthMm: 210, heightMm: 148, settleMs: 200 })
}

export function sendWholesaleWhatsApp(saleData: any) {
  const phone = saleData.party?.phone
  if (!phone) { return }
  const settings = getSettings()
  const shopName = settings.shopName
  const clean = phone.replace(/\D/g, '')
  const withCountry = clean.startsWith('91') ? clean : '91' + clean

  const items = saleData.cart.map((i: any) => {
    const d = [i.product.design_no, i.product.size, i.product.colour].filter(Boolean).join('/')
    return `  %E2%80%A2 ${encodeURIComponent(i.product.name)}${d ? ' (' + encodeURIComponent(d) + ')' : ''} x${i.qty} = *%E2%82%B9${i.line_total.toFixed(0)}*`
  }).join('%0A')

  const msg =
    `%F0%9F%9B%8D%EF%B8%8F *${encodeURIComponent(shopName)}* — Wholesale%0A` +
    `*Invoice: ${saleData.invoiceNo}*%0A` +
    `${saleData.date}%0A%0A` +
    `Party: *${encodeURIComponent(saleData.party?.business_name || saleData.party?.name)}*%0A%0A` +
    `${items}%0A%0A` +
    `*Net Payable: %E2%82%B9${saleData.netAmount.toFixed(0)}*%0A` +
    `Payment: ${encodeURIComponent(saleData.paymentMode)}%0A%0A` +
    `_Thank you for your business!_`

  sendWhatsApp(withCountry, msg, { encoded: true, features: 'width=600,height=700' })
}

/** The columns to load so a saved wholesale bill can be printed again. */
export const WHOLESALE_BILL_SELECT =
  '*, wholesale_customers(*), wholesale_sale_items(qty, unit_price, mrp, discount_pct, gst_rate, line_total, products(*))'

/**
 * A saved wholesale bill in the shape printWholesaleBill, sendWholesaleWhatsApp
 * and the e-way bill take — the same shape the bill had when it was made.
 */
export function saleDataFromRow(row: any) {
  const cart = (row.wholesale_sale_items || []).map((i: any) => {
    const taxable = Number(i.qty) * Number(i.unit_price) * (1 - (Number(i.discount_pct) || 0) / 100)
    return {
      product: i.products || { name: 'Product' }, qty: Number(i.qty), unit_price: Number(i.unit_price),
      mrp: Number(i.mrp) || 0, discount_pct: Number(i.discount_pct) || 0, gst_rate: Number(i.gst_rate) || 0,
      taxable_amount: taxable, gst_amount: taxable * (Number(i.gst_rate) || 0) / 100, line_total: Number(i.line_total) || 0,
    }
  })
  return {
    invoiceNo: row.invoice_no, date: fmtDateTime(new Date(row.created_at)), party: row.wholesale_customers || null, cart,
    subtotal: Number(row.subtotal) || 0, discountPct: Number(row.discount_pct) || 0, billDiscAmt: Number(row.discount_amount) || 0,
    freight: Number(row.freight) || 0, gstType: row.gst_type || 'gst', gstAmount: Number(row.gst_amount) || 0,
    roundOff: Number(row.round_off) || 0, netAmount: Number(row.net_amount) || 0,
    paymentMode: row.payment_mode, notes: row.notes || '',
  }
}
