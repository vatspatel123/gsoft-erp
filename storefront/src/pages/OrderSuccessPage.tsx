import { useLocation, Link } from 'react-router-dom'
import { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { generateWhatsAppOrderLink } from '../api/storefront'
import type { AddressForm } from './CheckoutAddressPage'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')

export function OrderSuccessPage() {
  const location = useLocation()
  const { settings } = useWebsiteSettings()
  const state = location.state as { order: any; address: AddressForm } | null

  if (!state) {
    return (
      <main className="container" style={{ padding: '70px 24px', textAlign: 'center' }}>
        No recent order found. <Link to="/shop">Continue shopping</Link>
      </main>
    )
  }

  const { order, address } = state
  const whatsappLink = settings.whatsapp_number
    ? generateWhatsAppOrderLink(
        settings.whatsapp_number,
        { name: address.name, phone: address.phone, address: address.address, city: address.city },
        order.items || [],
        order.net_amount
      )
    : null

  return (
    <main className="container" style={{ padding: '44px 24px 70px', maxWidth: 760 }}>
      <div style={{ background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 22, padding: '34px 30px', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, margin: '0 auto', borderRadius: 999, background: 'var(--blush)', display: 'grid', placeItems: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12.5 5 5L20 6.5" /></svg>
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,3.4vw,36px)', margin: '20px 0 8px' }}>Order placed!</h1>
        <p style={{ fontSize: 15, fontWeight: 300, color: 'rgba(51,59,71,.68)', margin: 0, lineHeight: 1.7 }}>
          Thank you, {address.name}. Your order <strong>{order.order_no}</strong> for {INR(order.net_amount)} has been received.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-pill btn-primary">Confirm on WhatsApp</a>
          )}
          <Link to="/order/track" className="btn-pill" style={{ border: '1px solid var(--navy)', background: 'transparent', color: 'var(--navy)' }}>Track my order</Link>
          <Link to="/shop" className="btn-pill" style={{ border: '1px solid var(--navy)', background: 'transparent', color: 'var(--navy)' }}>Continue shopping</Link>
        </div>
      </div>
    </main>
  )
}
