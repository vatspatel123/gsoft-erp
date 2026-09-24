import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext'
import { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { placeStorefrontOrder } from '../api/storefront'
import type { AddressForm } from './CheckoutAddressPage'
import type { OnlineOrderItem } from '../types/ecommerce'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')

export function CheckoutPaymentPage() {
  const { lines, subtotal, clear } = useCartContext()
  const { settings } = useWebsiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const address = location.state as AddressForm | null
  const [method, setMethod] = useState<'cod' | 'whatsapp'>('cod')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!address) {
    return <main className="container" style={{ padding: '70px 24px', textAlign: 'center' }}>Please fill in delivery details first.</main>
  }

  const deliveryFee = subtotal >= settings.min_order_free_shipping ? 0 : settings.standard_delivery_fee
  const total = subtotal + deliveryFee

  const handlePlaceOrder = async () => {
    setPlacing(true)
    setError(null)
    try {
      const items: OnlineOrderItem[] = lines.map(l => ({
        product_id: l.variantId,
        name: l.title,
        size: l.size || undefined,
        colour: l.colour || undefined,
        qty: l.qty,
        unit_price: l.unitPrice,
        mrp: l.mrp || undefined,
        line_total: l.unitPrice * l.qty,
        photo_url: l.photo || undefined
      }))

      const order = await placeStorefrontOrder({
        customerName: address.name,
        customerPhone: address.phone,
        customerEmail: address.email || undefined,
        shippingAddress: address.address,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        paymentMethod: method,
        items
      })

      clear()
      navigate('/order/success', { state: { order, address } })
    } catch (err: any) {
      setError(err.message || 'Could not place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <main className="container" style={{ padding: '30px 24px 70px', maxWidth: 1060 }}>
      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 280 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(51,59,71,.08)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500 }}>Payment</div>
              <div style={{ fontSize: 12.5, color: 'rgba(51,59,71,.55)', marginTop: 2 }}>Paying {INR(total)}</div>
            </div>
            <div>
              {settings.enable_cod && (
                <button type="button" onClick={() => setMethod('cod')} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  border: 'none', background: method === 'cod' ? 'var(--blush)' : 'transparent',
                  padding: '17px 22px', cursor: 'pointer', borderBottom: '1px solid rgba(51,59,71,.07)'
                }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${method === 'cod' ? 'var(--pink)' : 'rgba(51,59,71,.3)'}`, background: method === 'cod' ? 'var(--pink)' : 'transparent', flex: 'none' }} />
                  <span>
                    <span style={{ fontSize: 15, display: 'block' }}>Cash on Delivery</span>
                    <span style={{ fontSize: 12.5, color: 'rgba(51,59,71,.55)' }}>Pay in cash when your order arrives</span>
                  </span>
                </button>
              )}
              {settings.enable_whatsapp_checkout && (
                <button type="button" onClick={() => setMethod('whatsapp')} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  border: 'none', background: method === 'whatsapp' ? 'var(--blush)' : 'transparent',
                  padding: '17px 22px', cursor: 'pointer'
                }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${method === 'whatsapp' ? 'var(--pink)' : 'rgba(51,59,71,.3)'}`, background: method === 'whatsapp' ? 'var(--pink)' : 'transparent', flex: 'none' }} />
                  <span>
                    <span style={{ fontSize: 15, display: 'block' }}>Confirm via WhatsApp</span>
                    <span style={{ fontSize: 12.5, color: 'rgba(51,59,71,.55)' }}>We'll confirm your order and payment over WhatsApp</span>
                  </span>
                </button>
              )}
            </div>
            <div style={{ padding: '20px 22px' }}>
              {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="button" onClick={handlePlaceOrder} disabled={placing} className="btn-pill btn-primary" style={{ width: '100%', minHeight: 56, justifyContent: 'center', opacity: placing ? .6 : 1 }}>
                {placing ? 'Placing order...' : 'Place order'}
              </button>
            </div>
          </div>
        </div>

        <aside style={{ flex: '1 1 280px', minWidth: 260, background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(51,59,71,.55)', marginBottom: 14 }}>Order summary</div>
          {lines.map(l => (
            <div key={l.variantId} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(51,59,71,.07)' }}>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.3 }}>{l.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(51,59,71,.55)', marginTop: 2 }}>Size {l.size} · Qty {l.qty}</div>
              </div>
              <div style={{ fontSize: 13.5 }}>{INR(l.unitPrice * l.qty)}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(51,59,71,.12)', marginTop: 10, paddingTop: 12, fontSize: 17, fontWeight: 500 }}>
            <span>Amount payable</span><span>{INR(total)}</span>
          </div>
        </aside>
      </div>
    </main>
  )
}
