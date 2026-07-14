import type { GstType } from '../hooks/useWholesale'
import { getSettings } from './settings'

function numToWords(n: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const inWords = (num: number): string => {
    if (num < 20) return a[num]
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '')
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + inWords(num % 100) : '')
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + inWords(num % 1000) : '')
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + inWords(num % 100000) : '')
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + inWords(num % 10000000) : '')
  }
  const rupees = Math.floor(n)
  const paise = Math.round((n - rupees) * 100)
  let result = inWords(rupees) + ' Rupees'
  if (paise > 0) result += ' and ' + inWords(paise) + ' Paise'
  return result + ' Only'
}

export function printWholesaleBill(saleData: any) {
  const settings = getSettings()
  const shopName = settings.shopName
  const shopAddress = settings.shopAddress
  const shopPhone = settings.shopPhone
  const shopGstin = settings.gstin
  const shopState = settings.state

  const { party, cart, subtotal, discountPct, billDiscAmt, freight,
    gstType, gstAmount, roundOff, netAmount, invoiceNo, date, paymentMode, notes } = saleData

  const isIGST = (gstType as GstType) === 'igst'

  const itemRows = cart.map((item: any, idx: number) => {
    const taxable = item.qty * item.unit_price * (1 - item.discount_pct / 100)
    const halfGst = item.gst_rate / 2
    const gstAmt = taxable * (item.gst_rate / 100)
    const fashionDetail = [item.product.design_no, item.product.size, item.product.colour].filter(Boolean).join(' / ')
    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>
          <div style="font-weight:600">${item.product.name}</div>
          ${fashionDetail ? `<div style="font-size:9px;color:#64748b">${fashionDetail}</div>` : ''}
          ${item.product.hsn_code ? `<div style="font-size:9px;color:#94a3b8">HSN: ${item.product.hsn_code}</div>` : ''}
        </td>
        <td style="text-align:center">${item.product.hsn_code || '—'}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">₹${item.unit_price.toFixed(2)}</td>
        <td style="text-align:center">${item.discount_pct > 0 ? item.discount_pct + '%' : '—'}</td>
        <td style="text-align:right">₹${taxable.toFixed(2)}</td>
        ${isIGST
        ? `<td style="text-align:center">${item.gst_rate}%</td>
           <td style="text-align:right">₹${gstAmt.toFixed(2)}</td>`
        : `<td style="text-align:center">${halfGst}%</td>
           <td style="text-align:right">₹${(gstAmt / 2).toFixed(2)}</td>
           <td style="text-align:center">${halfGst}%</td>
           <td style="text-align:right">₹${(gstAmt / 2).toFixed(2)}</td>`
      }
        <td style="text-align:right;font-weight:600">₹${item.line_total.toFixed(2)}</td>
      </tr>`
  }).join('')

  const tableHeader = isIGST
    ? `<tr>
        <th>#</th><th>Description</th><th>HSN</th><th>Qty</th>
        <th>Rate</th><th>Disc%</th><th>Taxable</th>
        <th>IGST%</th><th>IGST Amt</th><th>Total</th>
       </tr>`
    : `<tr>
        <th>#</th><th>Description</th><th>HSN</th><th>Qty</th>
        <th>Rate</th><th>Disc%</th><th>Taxable</th>
        <th>CGST%</th><th>CGST</th><th>SGST%</th><th>SGST</th><th>Total</th>
       </tr>`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Wholesale Invoice ${invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: white; padding: 16mm; }
    .page { max-width: 210mm; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #1d4ed8; }
    .shop-name { font-size: 22px; font-weight: 800; color: #1d4ed8; letter-spacing: -0.5px; }
    .shop-details { font-size: 10px; color: #475569; margin-top: 4px; line-height: 1.6; }
    .inv-badge { text-align: right; }
    .inv-title { font-size: 18px; font-weight: 700; color: #1d4ed8; letter-spacing: 1px; text-transform: uppercase; }
    .inv-no { font-size: 13px; font-weight: 600; color: #1a1a1a; margin-top: 4px; }
    .inv-date { font-size: 10px; color: #64748b; margin-top: 2px; }

    /* Party info */
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .party-box-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .party-name { font-size: 13px; font-weight: 700; color: #1a1a1a; }
    .party-detail { font-size: 10px; color: #475569; margin-top: 2px; line-height: 1.5; }
    .gstin-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px; letter-spacing: 0.5px; }

    /* Items table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    thead tr { background: #1d4ed8; color: white; }
    th { padding: 7px 6px; text-align: left; font-size: 9px; font-weight: 600; letter-spacing: 0.03em; }
    td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }

    /* Totals */
    .totals-area { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .totals-table { width: 300px; }
    .tot-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .tot-row.sub { color: #475569; }
    .tot-row.disc { color: #16a34a; }
    .tot-row.gst-row { color: #475569; }
    .tot-row.freight { color: #475569; }
    .tot-row.net { font-size: 14px; font-weight: 800; color: #1d4ed8; border-top: 2px solid #1d4ed8; padding-top: 6px; margin-top: 4px; }

    /* Amount in words */
    .amt-words { background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
    .amt-words-label { font-size: 9px; color: #1d4ed8; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .amt-words-text { font-size: 11px; font-weight: 600; color: #1e3a8a; }

    /* Payment + notes */
    .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .footer-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .footer-box-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
    .payment-badge { background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; display: inline-block; }

    /* Sign area */
    .sign-area { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .sign-box { text-align: center; font-size: 10px; color: #64748b; }
    .sign-line { width: 120px; border-bottom: 1px solid #94a3b8; margin: 0 auto 4px; height: 30px; }

    @media print {
      body { padding: 8mm; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="shop-name">${shopName}</div>
      <div class="shop-details">
        ${shopAddress ? shopAddress + '<br>' : ''}
        ${shopPhone ? 'Ph: ' + shopPhone : ''}
        ${shopGstin ? '<br>GSTIN: ' + shopGstin : ''}
        ${shopState ? '<br>State: ' + shopState : ''}
      </div>
    </div>
    <div class="inv-badge">
      <div class="inv-title">Tax Invoice</div>
      <div class="inv-no">${invoiceNo}</div>
      <div class="inv-date">${date}</div>
      <div style="margin-top:6px;font-size:10px;color:#64748b">
        GST Type: <strong style="color:#1d4ed8">${isIGST ? 'IGST' : 'CGST + SGST'}</strong>
      </div>
    </div>
  </div>

  <!-- Party info -->
  <div class="party-grid">
    <div class="party-box">
      <div class="party-box-title">Bill To</div>
      <div class="party-name">${party.business_name || party.name}</div>
      ${party.name !== party.business_name ? `<div class="party-detail">${party.name}</div>` : ''}
      ${party.address ? `<div class="party-detail">${party.address}</div>` : ''}
      ${party.city ? `<div class="party-detail">${party.city}${party.state ? ', ' + party.state : ''}</div>` : ''}
      ${party.phone ? `<div class="party-detail">📱 ${party.phone}</div>` : ''}
      ${party.gstin ? `<div class="gstin-badge">GSTIN: ${party.gstin}</div>` : ''}
    </div>
    <div class="party-box">
      <div class="party-box-title">Ship To</div>
      <div class="party-name">${party.business_name || party.name}</div>
      ${party.address ? `<div class="party-detail">${party.address}</div>` : ''}
      ${party.city ? `<div class="party-detail">${party.city}${party.state ? ', ' + party.state : ''}</div>` : ''}
    </div>
  </div>

  <!-- Items -->
  <table>
    <thead>${tableHeader}</thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-area">
    <div class="totals-table">
      <div class="tot-row sub"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      ${billDiscAmt > 0 ? `<div class="tot-row disc"><span>Discount (${discountPct}%)</span><span>-₹${billDiscAmt.toFixed(2)}</span></div>` : ''}
      ${isIGST
      ? `<div class="tot-row gst-row"><span>IGST</span><span>₹${gstAmount.toFixed(2)}</span></div>`
      : `<div class="tot-row gst-row"><span>CGST</span><span>₹${(gstAmount / 2).toFixed(2)}</span></div>
         <div class="tot-row gst-row"><span>SGST</span><span>₹${(gstAmount / 2).toFixed(2)}</span></div>`}
      ${freight > 0 ? `<div class="tot-row freight"><span>Freight</span><span>₹${freight.toFixed(2)}</span></div>` : ''}
      ${Math.abs(roundOff) > 0.001 ? `<div class="tot-row sub"><span>Round Off</span><span>${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}</span></div>` : ''}
      <div class="tot-row net"><span>Net Payable</span><span>₹${netAmount.toFixed(2)}</span></div>
    </div>
  </div>

  <!-- Amount in words -->
  <div class="amt-words">
    <div class="amt-words-label">Amount in Words</div>
    <div class="amt-words-text">${numToWords(netAmount)}</div>
  </div>

  <!-- Footer -->
  <div class="footer-grid">
    <div class="footer-box">
      <div class="footer-box-title">Payment Details</div>
      <div class="payment-badge">${paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1)}</div>
      ${paymentMode === 'credit' ? '<div style="font-size:10px;color:#ef4444;margin-top:6px">⚠ Payment pending</div>' : '<div style="font-size:10px;color:#16a34a;margin-top:6px">✓ Paid</div>'}
    </div>
    <div class="footer-box">
      <div class="footer-box-title">Notes</div>
      <div style="font-size:10px;color:#475569">${notes || 'Thank you for your business!'}</div>
    </div>
  </div>

  <!-- Signatures -->
  <div class="sign-area">
    <div class="sign-box"><div class="sign-line"></div>Customer Signature</div>
    <div class="sign-box" style="text-align:right">
      <div style="font-size:9px;color:#1d4ed8;margin-bottom:4px">For ${shopName}</div>
      <div class="sign-line" style="margin:0 0 0 auto"></div>Authorised Signatory
    </div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
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

  window.open(`https://wa.me/${withCountry}?text=${msg}`, '_blank', 'width=600,height=700')
}
