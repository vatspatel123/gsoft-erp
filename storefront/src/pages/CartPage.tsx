import { Link, useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext'
import { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { QtyStepper } from '../components/QtyStepper'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')

export function CartPage() {
  const { lines, setQty, removeItem, subtotal } = useCartContext()
  const { settings } = useWebsiteSettings()
  const navigate = useNavigate()

  const deliveryFee = subtotal >= settings.min_order_free_shipping ? 0 : settings.standard_delivery_fee
  const total = subtotal + deliveryFee

  return (
    <main className="container" style={{ padding: '30px 24px 70px', maxWidth: 1120 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(28px,3.6vw,40px)', margin: '0 0 4px' }}>Your Bag</h1>
      <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(51,59,71,.6)', fontWeight: 300 }}>{lines.reduce((s, l) => s + l.qty, 0)} item(s)</p>

      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lines.length === 0 && (
            <div style={{ background: '#fff', border: '1px dashed rgba(51,59,71,.2)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21 }}>Your bag is empty</div>
              <Link to="/shop" className="btn-pill btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Shop new arrivals</Link>
            </div>
          )}
          {lines.map(l => (
            <div key={l.variantId} style={{ display: 'flex', gap: 16, background: '#fff', border: '1px solid rgba(51,59,71,.08)', borderRadius: 16, padding: 14 }}>
              <div style={{ flex: 'none', width: 96, aspectRatio: '4/5', borderRadius: 11, overflow: 'hidden', background: '#EFE7E1' }}>
                {l.photo && <img src={l.photo} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500 }}>{l.title}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(51,59,71,.6)' }}>Size {l.size} {l.colour ? `· ${l.colour}` : ''}</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{INR(l.unitPrice)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2, flexWrap: 'wrap' }}>
                  <QtyStepper qty={l.qty} onChange={n => setQty(l.variantId, n)} />
                  <button type="button" onClick={() => removeItem(l.variantId)} style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'rgba(51,59,71,.55)', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <aside style={{ flex: '1 1 300px', minWidth: 270, background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(51,59,71,.55)' }}>Order summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '10px 0', color: 'rgba(51,59,71,.7)' }}><span>Subtotal</span><span>{INR(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '10px 0', color: 'rgba(51,59,71,.7)' }}><span>Delivery</span><span>{deliveryFee === 0 ? 'Free' : INR(deliveryFee)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(51,59,71,.12)', marginTop: 12, paddingTop: 14, fontSize: 18, fontWeight: 500 }}>
              <span>Total</span><span>{INR(total)}</span>
            </div>
            <button type="button" onClick={() => navigate('/checkout')} className="btn-pill btn-primary" style={{ width: '100%', marginTop: 18, minHeight: 54, justifyContent: 'center' }}>Checkout</button>
          </aside>
        )}
      </div>
    </main>
  )
}
