import { getSettings } from './settings'

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

  const win = window.open('', '_blank', 'width=400,height=600')
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 500) }
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

  window.open(`https://wa.me/${withCountry}?text=${msg}`, '_blank')
}

export function printBill(saleData: any) {
  const {
    invoiceNo, cart, customer,
    subtotal, gstAmount, totalDiscount,
    netAmount, paymentMode, date, note
  } = saleData

  const s = getSettings()
  const shopName = s.shopName || 'Retail ERP'
  const shopAddress = s.shopTagline ? `${s.shopTagline}${s.shopAddress ? ' · ' + s.shopAddress : ''}` : s.shopAddress || 'Fashion Edition · Ahmedabad'
  const shopPhone = s.shopPhone || ''
  const shopGSTIN = s.showGSTIN ? (s.gstin || '') : ''
  const billFooter = s.billFooter || 'Thank you for shopping!'

  const itemRows = cart.map((item: any) => {
    const p = item.product
    const designNo = p.design_no || '—'
    const size = p.size || '—'
    const colour = p.colour || '—'
    const mrpLine = p.mrp && p.mrp !== item.unit_price
      ? `<br><small style="color:#94a3b8;font-size:9px;">MRP: ₹${p.mrp}</small>`
      : ''
    const batchLine = p.batch_no
      ? `<br><small style="color:#94a3b8;font-size:9px;">Batch: ${p.batch_no}</small>`
      : ''
    const barcodeLine = p.barcode
      ? `<div style="font-size:8px;color:#94a3b8;font-family:monospace">${p.barcode}</div>`
      : ''
    return `
    <tr>
      <td>
        <div style="font-size:11px;font-weight:500">${p.name}</div>
        ${p.size || p.colour || p.design_no ? `<div style="font-size:9px;color:#64748b">${[p.design_no, p.size, p.colour].filter(Boolean).join(' | ')}</div>` : ''}
        ${barcodeLine}
        ${mrpLine}${batchLine}
      </td>
      <td style="text-align:center">${designNo}</td>
      <td style="text-align:center">${size}</td>
      <td style="text-align:center">${colour}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">₹${item.unit_price.toFixed(2)}</td>
      <td style="text-align:right">₹${item.line_total.toFixed(2)}</td>
    </tr>
  `}).join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoiceNo}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: 'DM Sans', Arial, sans-serif;
          font-size: 12px;
          color: #1a0a2e;
          padding: 20px;
          max-width: 80mm;
        }
        .header { text-align:center; margin-bottom:12px; }
        .shop-name {
          font-size:18px;
          font-weight:700;
          color:#9333ea;
        }
        .shop-sub {
          font-size:11px;
          color:#64748b;
          margin-top:2px;
        }
        .divider {
          border-top:1px dashed #e9d5ff;
          margin:8px 0;
        }
        .invoice-no {
          font-size:11px;
          color:#64748b;
          margin-bottom:4px;
        }
        .customer-section {
          margin: 6px 0;
          padding: 6px 0;
          border-bottom: 1px dashed #f3e8ff;
        }
        .cust-name {
          font-size: 13px;
          font-weight: 600;
          color: #9333ea;
        }
        .cust-detail {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        table {
          width:100%;
          border-collapse:collapse;
          margin:8px 0;
        }
        th {
          font-size:9px;
          text-align:left;
          color:#9333ea;
          border-bottom:1px solid #f3e8ff;
          padding:4px 2px;
        }
        td {
          font-size:10px;
          padding:4px 2px;
          border-bottom:1px solid #fdf8ff;
          vertical-align:top;
        }
        .totals { margin-top:8px; }
        .total-row {
          display:flex;
          justify-content:space-between;
          font-size:11px;
          padding:2px 0;
          color:#64748b;
        }
        .total-row.net {
          font-size:14px;
          font-weight:700;
          color:#9333ea;
          border-top:2px solid #9333ea;
          margin-top:6px;
          padding-top:6px;
        }
        .payment-badge {
          display:inline-block;
          background:#f5f3ff;
          color:#9333ea;
          padding:2px 8px;
          border-radius:99px;
          font-size:10px;
          margin-top:6px;
        }
        .footer {
          text-align:center;
          margin-top:14px;
          font-size:10px;
          color:#94a3b8;
        }
        .footer .thank {
          font-size:13px;
          font-weight:600;
          color:#9333ea;
          margin-bottom:4px;
        }
        @media print {
          body { padding:4px; }
          @page { margin:4mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-name">${shopName}</div>
        <div class="shop-sub">${shopAddress}</div>
        ${shopPhone ? `<div class="shop-sub">📞 ${shopPhone}</div>` : ''}
        ${shopGSTIN ? `<div class="shop-sub">GSTIN: ${shopGSTIN}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="invoice-no">Invoice: <strong>${invoiceNo}</strong></div>
      <div class="invoice-no">Date: ${date}</div>
      ${saleData.salesmanName ? `<div class="invoice-no">Served by: <strong>${saleData.salesmanName}</strong></div>` : ''}
      ${customer ? `
        <div class="customer-section">
          <div class="cust-name">${customer.name}</div>
          ${customer.phone ? `<div class="cust-detail">📱 ${customer.phone}</div>` : ''}
          ${customer.email ? `<div class="cust-detail">✉️ ${customer.email}</div>` : ''}
        </div>
      ` : '<div class="cust-name">Walk-in Customer</div>'}
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center">Design</th>
            <th style="text-align:center">Size</th>
            <th style="text-align:center">Colour</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="divider"></div>
      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>₹${subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>GST</span>
          <span>₹${gstAmount.toFixed(2)}</span>
        </div>
        ${totalDiscount > 0 ? `
          <div class="total-row">
            <span>Discount</span>
            <span>-₹${totalDiscount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="total-row net">
          <span>Net Payable</span>
          <span>₹${netAmount.toFixed(2)}</span>
        </div>
      </div>
      <div>
        <span class="payment-badge">
          ${paymentMode === 'upi' ? '✓ Paid via UPI' : paymentMode === 'credit' ? '⚠️ CREDIT SALE (UDHAR)' : paymentMode.toUpperCase()}
        </span>
      </div>
      ${paymentMode === 'credit' ? `
        <div style="background:#fef2f2;border:1px dashed #ef4444;border-radius:6px;padding:6px 8px;margin-top:8px;text-align:center;">
          <div style="color:#b91c1c;font-weight:700;font-size:11px;">⚠️ ઉધાર ખરીદી (CREDIT BILL)</div>
          <div style="color:#7f1d1d;font-size:10px;margin-top:2px;">
            Promised Due Date: <strong>${saleData.creditDueDate ? new Date(saleData.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'In 5 Days'}</strong>
            ${saleData.creditDueDays ? ` (${saleData.creditDueDays} days)` : ''}
          </div>
        </div>
      ` : ''}
      ${note ? `
        <div class="divider"></div>
        <div style="font-size:11px;color:#64748b;font-style:italic;">Note: ${note}</div>
      ` : ''}
      <div class="divider"></div>
      <div class="footer">
        <div class="thank">${billFooter}</div>
        <div>Visit us again soon</div>
        <div style="margin-top:4px">Powered by Retail ERP</div>
      </div>
    </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=400,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
  }
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
  const win = window.open('', '_blank', 'width=380,height=500')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }
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
  window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank')
}

// ─── Purchase Return Slip Print ─────────────────────────────────────────────
export function printPurchaseReturn(returnData: {
  returnNo: string
  supplierName: string
  supplierPhone?: string
  totalAmount: number
  reason?: string
  items: Array<{
    productName: string
    size?: string
    colour?: string
    qty: number
    unitCost: number
    lineTotal: number
  }>
  createdAt: string
}) {
  const s = getSettings()
  const shopName = s.shopName || 'Retail ERP'
  const dateStr = new Date(returnData.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  const itemRows = returnData.items.map(item => `
    <tr>
      <td>${item.productName} ${item.size ? `<span style="color:#64748b">(${item.size})</span>` : ''}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">₹${Number(item.unitCost).toFixed(2)}</td>
      <td style="text-align:right">₹${Number(item.lineTotal).toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Debit Note - ${returnData.returnNo}</title>
      <style>
        body { font-family: 'DM Sans', system-ui, sans-serif; padding: 16px; max-width: 400px; margin: 0 auto; color: #1e293b; }
        .header { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 12px; }
        .shop-name { font-size: 18px; font-weight: 800; color: #1e293b; }
        .title-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
        th { text-align: left; border-bottom: 1px solid #cbd5e1; padding: 6px 2px; color: #64748b; font-size: 11px; }
        td { padding: 6px 2px; border-bottom: 1px solid #f1f5f9; }
        .total-box { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #dc2626; border-top: 2px solid #dc2626; padding-top: 8px; margin-top: 8px; }
        @media print { @page { margin: 4mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-name">${shopName}</div>
        <div class="title-badge">PURCHASE RETURN / DEBIT NOTE</div>
        <div style="font-size:12px;font-weight:700">Debit Note No: ${returnData.returnNo}</div>
        <div style="font-size:11px;color:#64748b">Date: ${dateStr}</div>
      </div>
      <div style="font-size:12px;margin-bottom:8px">
        <strong>Vendor:</strong> ${returnData.supplierName} ${returnData.supplierPhone ? `(${returnData.supplierPhone})` : ''}
      </div>
      ${returnData.reason ? `<div style="font-size:11px;color:#64748b;margin-bottom:8px">Reason: ${returnData.reason}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="total-box">
        <span>Total Debit Amount</span>
        <span>₹${Number(returnData.totalAmount).toFixed(2)}</span>
      </div>
      <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
        <div>Authorized Signatory</div>
        <div>Vendor Signature</div>
      </div>
    </body>
    </html>
  `
  const win = window.open('', '_blank', 'width=450,height=600')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }
}

