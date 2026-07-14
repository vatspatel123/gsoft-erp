export function sendBillWhatsApp(
  saleData: any,
  phone?: string
) {
  const targetPhone =
    phone || saleData?.customer?.phone

  if (!targetPhone) {
    alert('Please enter WhatsApp number')
    return
  }

  const clean = targetPhone
    .replace(/\D/g, '')
  const withCountry =
    clean.startsWith('91')
      ? clean : '91' + clean

  const {
    invoiceNo, cart, subtotal,
    gstAmount, totalDiscount,
    netAmount, paymentMode, customer
  } = saleData

  const items = cart.map((i: any) =>
    `• ${i.product.name} x${i.qty} = ` +
    `₹${i.line_total.toFixed(0)}`
  ).join('\n')

  const disc = (totalDiscount || 0) > 0
    ? `\nDiscount: -₹${
        totalDiscount.toFixed(0)
      }` : ''

  const greeting = customer?.name
    ? `Dear ${customer.name},\n\n` : ''

  const message =
    `${greeting}` +
    `🧾 *Invoice: ${invoiceNo}*\n` +
    `📅 ${new Date()
      .toLocaleDateString('en-IN')}\n` +
    `${'─'.repeat(20)}\n` +
    `${items}\n` +
    `${'─'.repeat(20)}\n` +
    `Subtotal: ₹${
      (subtotal || 0).toFixed(0)
    }\n` +
    `GST: ₹${
      (gstAmount || 0).toFixed(0)
    }${disc}\n` +
    `*Total: ₹${
      (netAmount || 0).toFixed(0)
    }*\n` +
    `Payment: ${
      (paymentMode || 'CASH').toUpperCase()
    }\n` +
    `${'─'.repeat(20)}\n` +
    `Thank you for shopping! ✨\n` +
    `_Retail ERP Fashion Edition_`

  const encoded = encodeURIComponent(message)
  const waUrl =
    `https://wa.me/${withCountry}` +
    `?text=${encoded}`

  // Open WhatsApp directly in new tab
  // without blank page flash
  const link = document.createElement('a')
  link.href = waUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
