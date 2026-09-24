import { Link } from 'react-router-dom'
import type { ProductFamily } from '../hooks/useCatalog'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')

export function ProductCard({ family }: { family: ProductFamily }) {
  const photo = family.photos[0]
  return (
    <Link to={`/product/${family.familyId}`} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ position: 'relative', aspectRatio: '4/5', background: '#F6E6EE', overflow: 'hidden', borderRadius: 18 }}>
        {photo
          ? <img src={photo} alt={family.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'rgba(51,59,71,.4)', fontSize: 13 }}>{family.title}</div>}
        <div style={{
          position: 'absolute', top: 11, right: 11,
          background: family.tag === 'New' ? 'rgba(255,255,255,.94)' : 'var(--pink)',
          color: family.tag === 'New' ? 'var(--navy)' : '#fff',
          fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', padding: '6px 11px', borderRadius: 999
        }}>{family.tag}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, margin: 0, lineHeight: 1.25, color: 'var(--navy)' }}>{family.title}</h3>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15 }}>
          <span style={{ fontWeight: 500, color: 'var(--pink)' }}>{INR(family.price)}</span>
          {family.was && <span style={{ fontSize: 12.5, fontWeight: 300, color: 'rgba(51,59,71,.42)', textDecoration: 'line-through' }}>{INR(family.was)}</span>}
        </div>
        {family.sizes.length > 0 && (
          <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(51,59,71,.55)' }}>
            Sizes: {family.sizes.join(', ')}
          </div>
        )}
      </div>
    </Link>
  )
}
