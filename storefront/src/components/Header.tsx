import { Link } from 'react-router-dom'

export function Header({ bagCount }: { bagCount: number }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(251,247,244,.9)', backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(51,59,71,.08)'
    }}>
      <div className="container" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          <img src="/assets/urmii-logo.png" alt="Urmii All Plus" style={{ height: 46, width: 'auto', display: 'block' }} />
        </Link>
        <nav style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 30, fontSize: 13.5, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          <Link to="/shop">New Arrivals</Link>
          <Link to="/shop">Collections</Link>
          <a href="/#fit">Fit Guide</a>
        </nav>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link
            to="/cart"
            aria-label="Shopping bag"
            style={{
              position: 'relative', width: 44, height: 44, display: 'grid', placeItems: 'center',
              color: 'var(--navy)', borderRadius: 999
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {bagCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 2, minWidth: 18, height: 18, padding: '0 4px',
                borderRadius: 999, background: 'var(--pink)', color: '#fff', fontSize: 10.5, fontWeight: 600,
                display: 'grid', placeItems: 'center'
              }}>{bagCount}</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
