import { getSettings, billPrintWidthMm, type AppSettings } from './settings'
import { printHTML, printRaw, useRawBill } from './printHTML'
import { printPurchaseA4 } from './printA4Purchase'
import toast from 'react-hot-toast'
import { sendWhatsApp } from './whatsapp'
import { buildBillOps } from './escposBill'

export function printExchangeBill(exchangeData: any) {
  const s = getSettings()
  const shopName = s.shopName || 'Retail ERP'

  const returnRows = exchangeData.returnItems.map((item: any) => `
    <tr style="background:#fef2f2">
      <td>↩ ${item.product.name}${item.product.size ? ' - ' + item.product.size : ''}${item.product.colour ? ' ' + item.product.colour : ''}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right;color:#ef4444">-₹${item.line_total.toFixed(2)}</td>
    </tr>`).join('')

  const newRows = exchangeData.newItems.map((item: any) => `
    <tr style="background:#f0fdf4">
      <td>+ ${item.product.name}${item.product.size ? ' - ' + item.product.size : ''}${item.product.colour ? ' ' + item.product.colour : ''}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right;color:#16a34a">+₹${item.line_total.toFixed(2)}</td>
    </tr>`).join('')

  const balanceText = exchangeData.balance === 0
    ? 'Zero Balance Exchange'
    : exchangeData.balance > 0
    ? 'Customer Paid: ₹' + Math.abs(exchangeData.balance).toFixed(2)
    : 'Store Credit: ₹' + Math.abs(exchangeData.balance).toFixed(2)

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Exchange ${exchangeData.exchangeNo}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px;max-width:80mm;margin:0 auto;color:#1a0a2e}
      .header{text-align:center;margin-bottom:12px}
      .shop-name{font-size:16px;font-weight:700;color:#9333ea}
      .exchange-badge{display:inline-block;background:#f5f3ff;color:#9333ea;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;margin:6px 0}
      .divider{border-top:1px dashed #e9d5ff;margin:8px 0}
      table{width:100%;border-collapse:collapse}
      th{font-size:10px;color:#9333ea;padding:4px 2px;border-bottom:1px solid #f3e8ff;text-align:left}
      td{font-size:11px;padding:4px 2px}
      .section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin:8px 0 4px}
      .balance-row{font-size:13px;font-weight:700;color:#9333ea;border-top:2px solid #9333ea;padding-top:8px;margin-top:6px;display:flex;justify-content:space-between}
      .footer{text-align:center;margin-top:14px;font-size:10px;color:#94a3b8}
      @media print{@page{margin:4mm}}
    </style></head><body>
    <div class="header">
      <div class="shop-name">${shopName}</div>
      <div class="exchange-badge">EXCHANGE RECEIPT</div>
    </div>
    <div style="font-size:11px;color:#64748b">Exchange No: <strong>${exchangeData.exchangeNo}</strong></div>
    <div style="font-size:11px;color:#64748b">Original Bill: ${exchangeData.originalInvoiceNo}</div>
    <div style="font-size:11px;color:#64748b">Date: ${new Date().toLocaleString('en-IN')}</div>
    ${exchangeData.customer ? `<div style="font-size:11px;color:#64748b">Customer: ${exchangeData.customer.name} · ${exchangeData.customer.phone}</div>` : ''}
    <div class="divider"></div>
    <div class="section-label">Items Returned</div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${returnRows}</tbody></table>
    <div class="section-label">Items Given</div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${newRows}</tbody></table>
    <div class="divider"></div>
    <div class="balance-row"><span>${balanceText}</span></div>
    <div class="divider"></div>
    <div class="footer">
      <div style="font-size:12px;font-weight:600;color:#9333ea">Exchange Completed ✓</div>
      <div>Thank you for your patience</div>
      <div style="margin-top:4px">Powered by Retail ERP</div>
    </div>
    </body></html>`

  printHTML(html)
}

export function sendExchangeWhatsApp(exchangeData: any) {
  const phone = exchangeData.customer?.phone
  if (!phone) { alert('No customer phone found'); return }
  const clean = phone.replace(/\D/g, '')
  const withCountry = clean.startsWith('91') ? clean : '91' + clean

  const returnList = exchangeData.returnItems.map((i: any) =>
    `↩ ${i.product.name}${i.product.size ? ' ' + i.product.size : ''}${i.product.colour ? ' ' + i.product.colour : ''} x${i.qty}`
  ).join('%0A')

  const newList = exchangeData.newItems.map((i: any) =>
    `✓ ${i.product.name}${i.product.size ? ' ' + i.product.size : ''}${i.product.colour ? ' ' + i.product.colour : ''} x${i.qty}`
  ).join('%0A')

  const balanceMsg = exchangeData.balance === 0
    ? 'Zero Balance ✓'
    : exchangeData.balance > 0
    ? `You paid: ₹${Math.abs(exchangeData.balance).toFixed(0)}`
    : `Store credit: ₹${Math.abs(exchangeData.balance).toFixed(0)}`

  const msg = `Dear ${exchangeData.customer?.name || 'Customer'},%0A%0A` +
    `✅ *Exchange Completed*%0A` +
    `📋 Ref: ${exchangeData.exchangeNo}%0A` +
    `📄 Original: ${exchangeData.originalInvoiceNo}%0A` +
    `━━━━━━━━━━━━━━%0A` +
    `*Returned:*%0A${returnList}%0A` +
    `━━━━━━━━━━━━━━%0A` +
    `*Given:*%0A${newList}%0A` +
    `━━━━━━━━━━━━━━%0A` +
    `${balanceMsg}%0A%0A` +
    `Thank you for shopping! 🛍️%0A` +
    `_Retail ERP Fashion Edition_`

  sendWhatsApp(withCountry, msg, { encoded: true })
}

const esc = (v: any) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const money = (n: any) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The WhatsApp message that accompanies the bill PDF.
 *
 * Deliberately short: the PDF carries the itemised detail, so the message only
 * confirms the bill and points the customer at the shop's review / social links.
 * Links are skipped when not configured, so shops without them send a clean note.
 */
export function buildBillMessage(saleData: any, settingsOverride?: Partial<AppSettings>): string {
  const s = { ...getSettings(), ...(settingsOverride || {}) }
  const { invoiceNo, customer, netAmount = 0, date } = saleData

  const when = date ? new Date(date) : new Date()
  const valid = !isNaN(when.getTime()) ? when : new Date()
  const dateStr = valid.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const lines: string[] = []

  const who = [customer?.phone, customer?.name].filter(Boolean).join(' ')
  if (who) lines.push(who)

  lines.push(
    `Your Bill No. ${invoiceNo} of`,
    `Rs. ${Number(netAmount).toFixed(2)}`,
    `has been generated on ${dateStr}.`,
    '',
    'Thanks,',
    s.shopName || 'Retail ERP',
  )

  if (s.googleReviewUrl) lines.push('', 'Review us on Google', s.googleReviewUrl)
  if (s.instagramUrl) lines.push('', 'Follow us on Instagram', s.instagramUrl)

  return lines.join('\n')
}

// The single source of truth for the bill layout. printBill() shows it on screen;
// the WhatsApp PDF renders this exact same HTML, so the two can never drift apart.
//
// Deliberately black-on-white with no theme colour: these go to thermal printers,
// which have no colour and render heavy bold text best.
export function buildBillHTML(saleData: any, settingsOverride?: Partial<AppSettings>): string {
  const {
    invoiceNo, cart = [], customer,
    subtotal = 0, totalDiscount = 0, netAmount = 0,
    paymentMode, tenders, creditRemainder = 0,
    salesmanName, date, note,
  } = saleData

  // The override lets the Settings preview render unsaved edits live.
  const s = { ...getSettings(), ...(settingsOverride || {}) }
  const widthMm = billPrintWidthMm(s as AppSettings)

  const when = date ? new Date(date) : new Date()
  const valid = !isNaN(when.getTime()) ? when : new Date()
  const dateStr = valid.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = valid.toLocaleTimeString('en-IN', { hour12: false })

  const itemRows = cart.map((item: any, i: number) => {
    const p = item.product || {}
    // Category arrives differently depending on the screen: the POS embeds
    // categories(name), a reprint sets `category` directly. Accept either.
    const category = p.category || p.categories?.name || ''
    return `
      <tr class="item">
        <td class="ctr">${i + 1}</td>
        <td class="cat">${esc(category)}${p.colour ? `<div class="sub">${esc(p.colour)}</div>` : ''}</td>
        <td class="code">${esc(p.barcode || p.batch_no || '')}</td>
        <td class="ctr nw">${esc(p.size || '')}</td>
        <td class="ctr">${item.qty}</td>
        <td class="num">${money(item.unit_price)}</td>
        <td class="num">${money(item.line_total)}</td>
      </tr>`
  }).join('')

  const totalQty = cart.reduce((n: number, i: any) => n + Number(i.qty || 0), 0)

  const terms = (s.billTerms || '')
    .split('\n').map(t => t.trim()).filter(Boolean)
    .map(t => `<div>* ${esc(t)}</div>`).join('')

  const payRows: string[] = []
  if (s.showPaymentBreakdown) {
    const t = tenders || {}
    const entries: [string, number][] = [
      ['Cash', Number(t.cash || 0)],
      ['UPI', Number(t.upi || 0)],
      ['Card', Number(t.card || 0)],
      ['Udhar', Number(creditRemainder || 0)],
    ]
    // No tender split recorded (older sales, or a single-mode sale) — show the
    // whole amount against the mode that was used rather than four zeroes.
    const anySplit = entries.some(([, v]) => v > 0)
    const rows = anySplit ? entries : [[String(paymentMode || 'Cash').toUpperCase(), Number(netAmount)] as [string, number]]
    for (const [label, val] of rows) {
      payRows.push(`<div class="pk">${esc(label)} :</div><div class="pv">${money(val)}</div>`)
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${esc(invoiceNo)}</title>
  <style>
    @page { margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px; font-weight: 700;
      color: #000; background: #fff;
      /* Left-aligned, NEVER centred. On a printer whose paper is wider than the
         receipt, an auto side margin pushes the bill into the middle of the page
         and a narrow roll catches only a sliver of it at one edge. */
      width: ${widthMm}mm; padding: 3mm; margin: 0;
    }
    .center { text-align:center; }
    .logo { max-width:60%; max-height:22mm; object-fit:contain; margin-bottom:3px; }
    .shop { font-size:19px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; line-height:1.15; }
    .brand { font-size:13px; letter-spacing:2px; margin-top:3px; }
    .addr { font-size:11px; margin-top:4px; line-height:1.35; }
    .phone { font-size:13px; margin-top:3px; }
    .gstin { font-size:10px; margin-top:2px; font-weight:400; }
    .rule { border-top:1.5px solid #000; margin:6px 0; }

    /* The customer / bill-number block and the item table used to be bold,
       cramped and split words mid-way ("Stan/dard", "9900000/00001"). Same
       columns and same content — just a quieter weight for the data, room
       between rows, and nothing broken in the middle of a word or a code. */
    .meta {
      display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
      font-size:11px; font-weight:400; line-height:1.55; padding:1px 0 5px;
    }
    .meta b { font-weight:700; }
    .meta .r { text-align:right; white-space:nowrap; }

    table { width:100%; border-collapse:collapse; }
    th {
      font-size:9.5px; font-weight:700; text-align:left; padding:5px 1px;
      border-top:1.5px solid #000; border-bottom:1.5px solid #000; white-space:nowrap;
    }
    td {
      font-size:10px; font-weight:400; padding:6px 1px; vertical-align:top;
      line-height:1.35; overflow-wrap:break-word;
    }
    tr.item + tr.item td { border-top:1px dotted #888; }
    .cat { font-weight:700; }
    /* A code is read digit by digit; wrapping it makes it two wrong numbers. */
    .code { font-size:8px; text-align:center; white-space:nowrap; font-variant-numeric:tabular-nums; letter-spacing:-.1px; }
    .nw { white-space:nowrap; font-size:9px; }
    .sub { font-size:9px; font-weight:400; }
    .ctr { text-align:center; }
    .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .totrow td {
      border-top:1.5px solid #000; border-bottom:1.5px solid #000;
      font-size:11px; font-weight:800; padding:7px 1px;
    }
    .adj { display:flex; justify-content:space-between; font-size:11px; padding:2px 0; }
    .net {
      display:flex; justify-content:center; align-items:baseline; gap:8px;
      font-size:16px; font-weight:800; padding:7px 0;
      border-bottom:1.5px solid #000;
    }
    .who { font-size:12px; margin-top:5px; }
    .terms { font-size:11px; line-height:1.5; margin-top:3px; }
    .time { font-size:11px; margin-top:4px; }
    .paytitle { font-size:11px; text-decoration:underline; margin-top:7px; }
    .pay { display:grid; grid-template-columns:auto 1fr auto 1fr; gap:2px 6px; font-size:11px; margin-top:3px; }
    .pv { font-variant-numeric:tabular-nums; }
    .credit { border:1.5px dashed #000; padding:4px; margin-top:6px; text-align:center; font-size:11px; }
    .note { font-size:11px; font-weight:400; font-style:italic; margin-top:5px; }
    .foot { text-align:center; font-style:italic; font-size:13px; margin-top:9px; }
  </style>
</head>
<body>
  <div class="center">
    ${s.shopLogo ? `<img class="logo" src="${esc(s.shopLogo)}" alt="">` : ''}
    <div class="shop">${esc(s.shopName || 'Retail ERP')}</div>
    ${s.shopTagline ? `<div class="brand">${esc(s.shopTagline)}</div>` : ''}
    ${s.shopAddress ? `<div class="addr">${esc(s.shopAddress)}</div>` : ''}
    ${s.shopPhone ? `<div class="phone">M. ${esc(s.shopPhone)}</div>` : ''}
    ${s.showGSTIN && s.gstin ? `<div class="gstin">GSTIN: ${esc(s.gstin)}</div>` : ''}
  </div>

  <div class="rule"></div>

  <div class="meta">
    <div>${s.showCustomer && customer ? `<b>${esc(customer.phone || '')}</b> ${esc(customer.name || '')}` : ''}</div>
    <div class="r">
      <div>Bill No.: <b>${esc(invoiceNo)}</b></div>
      <div>Bill Date.: <b>${dateStr}</b></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="ctr" style="width:6%">No.</th>
        <th style="width:17%">Category</th>
        <th class="code" style="width:22%">Barcode</th>
        <th class="ctr" style="width:14%">Size</th>
        <th class="ctr" style="width:6%">Qty</th>
        <th class="num" style="width:16%">Rate</th>
        <th class="num" style="width:19%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="totrow">
        <td></td>
        <td colspan="3">Total</td>
        <td class="ctr">${totalQty}</td>
        <td></td>
        <td class="num">${money(subtotal)}</td>
      </tr>
    </tbody>
  </table>

  ${totalDiscount > 0 ? `
    <div class="adj"><span>Discount</span><span>- ${money(totalDiscount)}</span></div>
  ` : ''}

  <div class="net"><span>Net Amt.: ₹</span><span>${money(netAmount)}</span></div>

  ${s.showSalesman && salesmanName ? `<div class="who">${esc(salesmanName)}</div>` : ''}
  ${terms ? `<div class="terms">${terms}</div>` : ''}
  <div class="time">Time : ${timeStr}</div>

  ${payRows.length ? `
    <div class="paytitle">Payment Details :</div>
    <div class="pay">${payRows.join('')}</div>
  ` : ''}

  ${creditRemainder > 0 ? `
    <div class="credit">
      <div>** UDHAR / CREDIT ₹${money(creditRemainder)} **</div>
      <div>Due: ${saleData.creditDueDate
        ? new Date(saleData.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : `${saleData.creditDueDays || 5} days`}</div>
    </div>
  ` : ''}

  ${note ? `<div class="note">Note: ${esc(note)}</div>` : ''}

  <div class="foot">${esc(s.billFooter || 'Thank you for shopping!')}</div>
</body>
</html>`

  return html
}

/**
 * Print a sales bill.
 *
 * On a thermal printer this goes out as raw ESC/POS bytes, which is the only
 * reliable way to drive one — a thermal driver has no real page for Chromium to
 * lay HTML onto, and that mismatch is what printed blank paper. A4 still renders
 * HTML, and so does the thermal path if the raw write fails for any reason.
 */
export function printBill(saleData: any) {
  if (!useRawBill()) { printHTML(buildBillHTML(saleData)); return }

  printRaw(buildBillOps(saleData)).then(res => {
    if (res.ok) return
    toast.error(`Receipt printer: ${res.reason || 'failed'} — using the print dialog`)
    printHTML(buildBillHTML(saleData))
  })
}

// ─── Credit Note Voucher Print ──────────────────────────────────────────────
export function printCreditNote(noteData: {
  creditNoteNo: string
  customerName: string
  customerPhone?: string
  amount: number
  balanceAmount: number
  notes?: string
  expiresAt?: string
  createdAt: string
}) {
  const s = getSettings()
  const shopName = s.shopName || 'Retail ERP'
  const shopPhone = s.shopPhone || ''
  const dateStr = new Date(noteData.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const expStr = noteData.expiresAt ? new Date(noteData.expiresAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '90 Days'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Credit Note - ${noteData.creditNoteNo}</title>
      <style>
        body { font-family: 'DM Sans', system-ui, sans-serif; padding: 16px; max-width: 320px; margin: 0 auto; color: #1e293b; }
        .header { text-align: center; border-bottom: 2px dashed #9333ea; padding-bottom: 12px; margin-bottom: 12px; }
        .shop-name { font-size: 18px; font-weight: 800; color: #9333ea; }
        .title-badge { display: inline-block; background: #9333ea; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; margin: 8px 0; letter-spacing: 0.05em; }
        .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
        .amount-box { background: #fdf4ff; border: 2px solid #e879f9; border-radius: 12px; padding: 12px; text-align: center; margin: 14px 0; }
        .amount { font-size: 24px; font-weight: 800; color: #9333ea; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        @media print { @page { margin: 4mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-name">${shopName}</div>
        ${shopPhone ? `<div style="font-size:11px;color:#64748b">📞 ${shopPhone}</div>` : ''}
        <div class="title-badge">STORE CREDIT NOTE</div>
        <div style="font-size:12px;font-weight:700">No: ${noteData.creditNoteNo}</div>
        <div style="font-size:11px;color:#64748b">Date: ${dateStr}</div>
      </div>
      <div class="row"><span>Customer:</span><strong>${noteData.customerName}</strong></div>
      ${noteData.customerPhone ? `<div class="row"><span>Phone:</span><span>${noteData.customerPhone}</span></div>` : ''}
      <div class="amount-box">
        <div style="font-size:11px;color:#701a75;font-weight:600">CREDIT BALANCE</div>
        <div class="amount">₹${Number(noteData.balanceAmount).toFixed(2)}</div>
        <div style="font-size:10px;color:#a21caf;margin-top:4px">Valid Until: ${expStr}</div>
      </div>
      ${noteData.notes ? `<div style="font-size:11px;color:#64748b;font-style:italic">Reason: ${noteData.notes}</div>` : ''}
      <div class="footer">
        <div>Please present this Credit Note number during your next purchase.</div>
        <div style="margin-top:4px">Thank you for shopping with us!</div>
      </div>
    </body>
    </html>
  `
  printHTML(html)
}

export function sendCreditNoteWhatsApp(noteData: {
  creditNoteNo: string
  customerName: string
  customerPhone?: string
  amount: number
  balanceAmount: number
  expiresAt?: string
}) {
  if (!noteData.customerPhone) {
    toast.error('Customer phone number not available')
    return
  }
  const s = getSettings()
  const shopName = s.shopName || 'Retail ERP'
  const expStr = noteData.expiresAt ? new Date(noteData.expiresAt).toLocaleDateString('en-IN') : '90 Days'

  const msg =
    `*🎫 STORE CREDIT NOTE — ${shopName}*%0A%0A` +
    `Dear *${noteData.customerName}*,%0A` +
    `Your Store Credit Note has been generated successfully!%0A%0A` +
    `• *Credit Note No:* ${noteData.creditNoteNo}%0A` +
    `• *Credit Balance:* ₹${Number(noteData.balanceAmount).toFixed(2)}%0A` +
    `• *Valid Until:* ${expStr}%0A%0A` +
    `_You can redeem this balance on your next visit._%0A` +
    `Thank you for choosing *${shopName}*!`

  const cleanPhone = noteData.customerPhone.replace(/\D/g, '')
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
  sendWhatsApp(fullPhone, msg, { encoded: true })
}

// ─── Purchase Return Slip Print ─────────────────────────────────────────────
/**
 * Purchase return = a debit memo to the supplier, and their accountant expects
 * it on A4 in the GST layout, not on receipt paper.
 */
export function printPurchaseReturn(returnData: {
  returnNo: string
  supplierName: string
  supplierPhone?: string
  supplierGstin?: string
  totalAmount: number
  reason?: string
  items: Array<{ productName: string; size?: string; colour?: string; hsn?: string
                 qty: number; unitCost: number; lineTotal?: number; gstRate?: number }>
  createdAt?: string
}) {
  printPurchaseA4({
    kind: 'return',
    docNo: returnData.returnNo,
    date: returnData.createdAt || new Date(),
    supplierName: returnData.supplierName,
    supplierGstin: returnData.supplierGstin,
    items: (returnData.items || []).map(it => ({
      name: [it.productName, it.colour, it.size].filter(Boolean).join(' · '),
      hsn: it.hsn || '',
      qty: Number(it.qty) || 0,
      rate: Number(it.unitCost) || 0,
      gstPct: Number(it.gstRate ?? 5),
    })),
    grandTotalOverride: Number(returnData.totalAmount) || undefined,
  })
}

