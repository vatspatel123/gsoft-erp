import { Check } from 'lucide-react';
import { useState } from 'react';
import { printBill } from '../../utils/printBill';
import toast from 'react-hot-toast';
import { getSettings } from '../../utils/settings';

interface BillModalProps {
  saleData: any;
  onClose: () => void;
  onNewSale: () => void;
}

export function BillModal({ saleData, onClose, onNewSale }: BillModalProps) {
  const [sent, setSent] = useState(false)

  const handlePrint = () => {
    printBill(saleData)
  }

  const handleWhatsApp = () => {
    const phone = saleData?.customer?.phone
    if (!phone) {
      toast.error('No phone number for this customer')
      return
    }

    const settings = getSettings()
    const shopName = settings.shopName || 'Retail ERP'
    const shopPhone = settings.shopPhone || ''
    const shopAddress = settings.shopAddress || ''

    const clean = phone.replace(/\D/g, '')
    const withCountry = clean.startsWith('91') ? clean : '91' + clean

    const date = new Date(saleData.date || Date.now()).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    const itemsList = saleData.cart.map((item: any) => {
      const details = [
        item.product.design_no,
        item.product.size,
        item.product.colour
      ].filter(Boolean).join(' | ')

      return (
        `  %E2%80%A2 ${encodeURIComponent(item.product.name)}` +
        (details ? ` _(${encodeURIComponent(details)})_` : '') +
        `%0A` +
        `    Qty: ${item.qty} %C3%97 ` +
        `%E2%82%B9${item.unit_price.toFixed(0)}` +
        ` = *%E2%82%B9${item.line_total.toFixed(0)}*`
      )
    }).join('%0A')

    const paymentEmoji =
      saleData.paymentMode === 'cash' ? '%F0%9F%92%B5' :
      saleData.paymentMode === 'card' ? '%F0%9F%92%B3' :
      saleData.paymentMode === 'upi'  ? '%F0%9F%93%B1' : '%E2%9A%A0%EF%B8%8F'

    const discountLine = saleData.totalDiscount > 0
      ? `%0A%F0%9F%8F%B7%EF%B8%8F *Discount:* -%E2%82%B9${saleData.totalDiscount.toFixed(0)}`
      : ''
    const gstLine = saleData.gstAmount > 0
      ? `%0A%F0%9F%A7%BE *GST:* %E2%82%B9${saleData.gstAmount.toFixed(0)}`
      : ''
    const loyaltyLine = saleData.loyaltyEarned > 0
      ? `%0A%E2%AD%90 *Loyalty Points Earned:* ${saleData.loyaltyEarned} pts`
      : ''

    const isCredit = saleData.paymentMode === 'credit'
    const formattedDueDate = saleData.creditDueDate ? new Date(saleData.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Within 5 Days'
    
    const creditTermsMsg = isCredit
      ? `%0A%E2%9A%A0%EF%B8%8F *UDHAR / CREDIT SALE*%0A` +
        `%F0%9F%93%85 *Promised Payment Due:* ${encodeURIComponent(formattedDueDate)} (${saleData.creditDueDays || 5} days)%0A` +
        `_આપનું બાકી બિલ ${encodeURIComponent(formattedDueDate)} સુધીમાં ચૂકવવાનું રહેશે._%0A`
      : ''

    const paymentLabel = isCredit
      ? `Credit / Udhar (Due: ${formattedDueDate})`
      : saleData.paymentMode.charAt(0).toUpperCase() + saleData.paymentMode.slice(1)
    const customerName = saleData.customer?.name || 'Customer'

    const message =
      `%F0%9F%9B%8D%EF%B8%8F *${encodeURIComponent(shopName)}*%0A` +
      (shopAddress ? `%F0%9F%93%8D ${encodeURIComponent(shopAddress)}%0A` : '') +
      `%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%0A` +
      `*INVOICE: ${saleData.invoiceNo}*%0A` +
      `%F0%9F%93%85 ${date}%0A` +
      `%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%0A%0A` +
      `%F0%9F%91%A4 *${encodeURIComponent(customerName)}*%0A%0A` +
      `*Items Purchased:*%0A` +
      `${itemsList}%0A%0A` +
      `%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%0A` +
      `${discountLine ? discountLine + '%0A' : ''}` +
      `${gstLine ? gstLine + '%0A' : ''}` +
      `${loyaltyLine ? loyaltyLine + '%0A' : ''}` +
      `${creditTermsMsg}` +
      `%F0%9F%92%B0 *Total Amount: %E2%82%B9${saleData.netAmount.toFixed(0)}*%0A` +
      `${paymentEmoji} *Payment Mode: ${encodeURIComponent(paymentLabel)}*%0A%0A` +
      `%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%E2%94%81%0A` +
      `_Thank you for shopping at ${encodeURIComponent(shopName)}!_ %F0%9F%99%8F%0A` +
      (shopPhone ? `%F0%9F%93%9E ${encodeURIComponent(shopPhone)}%0A` : '') +
      `%0A_For exchanges within 7 days, please bring this message or invoice number._`

    window.open(`https://wa.me/${withCountry}?text=${message}`, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes')
    setSent(true)
    toast.success('WhatsApp opened! ✅')
  }

  return (
    <div className="bill-modal-overlay" onClick={onClose}>
      <div className="bill-modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-check"><Check size={32} strokeWidth={3} /></div>
          <h2>Sale Complete!</h2>
          <p>Invoice: {saleData.invoiceNo}</p>
        </div>

        {/* Invoice preview */}
        <div className="modal-invoice-preview">
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#9333ea' }}>
              {getSettings().shopName}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Fashion Edition</div>
          </div>
          <div className="preview-divider" />
          <div className="preview-row"><span>Date:</span> <span>{saleData.date}</span></div>
          {saleData.customer && (
            <div className="preview-row">
              <span>Customer:</span>
              <span>{saleData.customer.name} ({saleData.customer.phone})</span>
            </div>
          )}
          {saleData.salesmanName && (
            <div className="preview-row">
              <span>Served by:</span>
              <span style={{ color: '#9333ea', fontWeight: 500 }}>{saleData.salesmanName}</span>
            </div>
          )}
          <div className="preview-divider" />
          <div style={{ marginBottom: '8px', color: '#64748b', fontSize: '12px' }}>Items:</div>
          {saleData.cart.map((i: any, idx: number) => (
            <div key={idx} className="preview-row">
              <span>{i.qty} × {i.product.name}
                {(i.product.size || i.product.colour) && (
                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                    {' '}({[i.product.size, i.product.colour].filter(Boolean).join(' ')})
                  </span>
                )}
              </span>
              <span>₹{i.line_total.toFixed(2)}</span>
            </div>
          ))}
          <div className="preview-divider" />
          <div className="preview-row"><span>Subtotal:</span> <span>₹{saleData.subtotal.toFixed(2)}</span></div>
          <div className="preview-row"><span>GST:</span> <span>₹{saleData.gstAmount.toFixed(2)}</span></div>
          {saleData.totalDiscount > 0 && (
            <div className="preview-row" style={{ color: '#16a34a' }}>
              <span>Discount:</span><span>-₹{saleData.totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="preview-row preview-net">
            <span>Net Payable:</span><span>₹{saleData.netAmount.toFixed(2)}</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              background: saleData.paymentMode === 'credit' ? '#fef2f2' : '#f5f3ff',
              color: saleData.paymentMode === 'credit' ? '#dc2626' : '#9333ea',
              padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'
            }}>
              {saleData.paymentMode === 'credit' ? '⚠️ CREDIT (UDHAR)' : saleData.paymentMode}
            </span>
            {saleData.paymentMode === 'credit' && (
              <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                Due: {saleData.creditDueDate ? new Date(saleData.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'in 5 days'}
              </span>
            )}
          </div>
        </div>

        {/* Delivery options */}
        <div style={{
          background: '#fdf8ff', border: '1px solid #f3e8ff',
          borderRadius: '14px', padding: '16px', marginBottom: '12px'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: '#9333ea',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px'
          }}>
            Send Bill To Customer
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* Print */}
            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'white', border: '1px solid #f3e8ff',
                borderRadius: '10px', padding: '12px 16px',
                cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c084fc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#f3e8ff')}
            >
              <span style={{ fontSize: '20px' }}>🖨️</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>Print Bill</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Print thermal receipt</div>
              </div>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '10px', padding: '12px 16px',
                cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#dcfce7')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f0fdf4')}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#15803d' }}>Send WhatsApp</div>
                <div style={{ fontSize: '11px', color: '#86efac' }}>
                  {saleData?.customer?.phone ? saleData.customer.phone : 'No phone number'}
                </div>
              </div>
              {sent && (
                <span style={{
                  background: '#dcfce7', color: '#16a34a',
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', flexShrink: 0
                }}>
                  ✓ Sent
                </span>
              )}
            </button>

            {/* Print + WhatsApp */}
            <button
              onClick={async () => {
                handlePrint()
                await new Promise(r => setTimeout(r, 500))
                handleWhatsApp()
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'linear-gradient(135deg, #f5f3ff, #f0fdf4)',
                border: '1px solid #e9d5ff',
                borderRadius: '10px', padding: '12px 16px',
                cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c084fc')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e9d5ff')}
            >
              <span style={{ fontSize: '20px' }}>🖨️💬</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>Print + WhatsApp</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Print receipt & send message</div>
              </div>
            </button>

          </div>
        </div>

        {/* New Sale */}
        <button
          onClick={() => { onNewSale(); onClose() }}
          style={{
            width: '100%', background: '#9333ea', color: 'white',
            border: 'none', borderRadius: '12px', padding: '14px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif'
          }}
        >
          + New Sale
        </button>
      </div>
    </div>
  )
}
