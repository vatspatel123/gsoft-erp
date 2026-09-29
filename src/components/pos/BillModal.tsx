import { Check } from 'lucide-react';
import { useState } from 'react';
import { printBill, buildBillHTML, buildBillMessage } from '../../utils/printBill';
import toast from 'react-hot-toast';
import { getSettings } from '../../utils/settings';
import { sendWhatsAppDocument } from '../../utils/whatsapp';

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

  const handleWhatsApp = async () => {
    const phone = saleData?.customer?.phone
    if (!phone) {
      toast.error('No phone number for this customer')
      return
    }

    // Short confirmation text; the PDF attachment carries the itemised bill.
    const how = await sendWhatsAppDocument(phone, {
      html: buildBillHTML(saleData),
      caption: buildBillMessage(saleData),
      fileName: `Invoice-${saleData.invoiceNo}.pdf`,
    })
    if (how !== 'failed') setSent(true)
    if (how === 'browser') toast.success('WhatsApp opened! ✅')
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
