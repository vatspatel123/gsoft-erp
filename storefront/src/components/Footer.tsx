import type { WebsiteSettings } from '../types/ecommerce'

export function Footer({ settings }: { settings: WebsiteSettings }) {
  return (
    <footer style={{ background: 'var(--navy)', color: 'var(--cream)', marginTop: 60 }}>
      <div className="container" style={{
        padding: 'clamp(44px,5vw,72px) 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 36
      }}>
        <div>
          <img src="/assets/urmii-logo-light.png" alt={settings.store_name} style={{ height: 52, width: 'auto', display: 'block', marginBottom: 16 }} />
          <p style={{ margin: '0 0 16px', maxWidth: '32ch', fontSize: 14, lineHeight: 1.65, fontWeight: 300, color: 'rgba(251,247,244,.62)' }}>
            {settings.tagline}
          </p>
          <div style={{ fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: 8 }}>Contact</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, fontWeight: 300, color: 'rgba(251,247,244,.62)' }}>
            {settings.whatsapp_number && <span>WhatsApp · {settings.whatsapp_number}</span>}
            {settings.contact_address && <span>{settings.contact_address}</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: 14 }}>Shop</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 14, fontWeight: 300 }}>
            <a href="/shop" style={{ color: 'rgba(251,247,244,.78)' }}>New Arrivals</a>
            <a href="/shop" style={{ color: 'rgba(251,247,244,.78)' }}>Best Sellers</a>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: 14 }}>Your Account</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 14, fontWeight: 300 }}>
            <a href="/order/track" style={{ color: 'rgba(251,247,244,.78)' }}>Track Order</a>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(251,247,244,.12)' }}>
        <div className="container" style={{
          padding: '18px 24px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between',
          fontSize: 12, fontWeight: 300, color: 'rgba(251,247,244,.5)'
        }}>
          <span>© {new Date().getFullYear()} {settings.store_name}</span>
        </div>
      </div>
    </footer>
  )
}
