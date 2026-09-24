import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'
import { useCartContext } from '../context/CartContext'
import { useToast } from '../hooks/useToast'
import { ColourSwatches } from '../components/ColourSwatches'
import { SizePicker } from '../components/SizePicker'
import { QtyStepper } from '../components/QtyStepper'
import { Accordion } from '../components/Accordion'
import { Toast } from '../components/Toast'
import { ProductCard } from '../components/ProductCard'
import { SIZE_CHART_ROWS, PDP_ACCORDION } from '../config/content'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')
const ALL_SIZES = ['L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL']

export function PdpPage() {
  const { familyId } = useParams<{ familyId: string }>()
  const navigate = useNavigate()
  const { getFamily, families, loading } = useCatalog()
  const { addItem } = useCartContext()
  const { text, fire } = useToast()

  const family = familyId ? getFamily(familyId) : undefined
  const [colour, setColour] = useState<string | null>(family?.colours[0] || null)
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [showChart, setShowChart] = useState(false)

  const variantsForColour = useMemo(
    () => family ? family.variants.filter(v => !colour || v.colour === colour) : [],
    [family, colour]
  )
  const availableSizes = useMemo(
    () => variantsForColour.filter(v => v.stock_qty > 0).map(v => v.size).filter(Boolean) as string[],
    [variantsForColour]
  )
  const activeVariant = useMemo(
    () => variantsForColour.find(v => v.size === size),
    [variantsForColour, size]
  )
  const related = useMemo(
    () => family ? families.filter(f => f.familyId !== family.familyId && f.category === family.category).slice(0, 4) : [],
    [families, family]
  )

  if (loading) return <main className="container" style={{ padding: '70px 24px', textAlign: 'center' }}>Loading...</main>
  if (!family) return <main className="container" style={{ padding: '70px 24px', textAlign: 'center' }}>Product not found. <Link to="/shop">Back to shop</Link></main>

  const handleAdd = (goToCart: boolean) => {
    if (!activeVariant) { fire('Please select a size'); return }
    addItem({
      variantId: activeVariant.id,
      familyId: family.familyId,
      title: family.title,
      size: activeVariant.size,
      colour: activeVariant.colour,
      unitPrice: activeVariant.online_price ?? activeVariant.unit_price,
      mrp: activeVariant.mrp,
      photo: family.photos[0] || null
    }, qty)
    if (goToCart) navigate('/cart')
    else fire(family.title + ' added to bag')
  }

  return (
    <main className="container" style={{ padding: '22px 24px 70px' }}>
      <button type="button" onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'rgba(51,59,71,.6)', cursor: 'pointer', padding: '0 0 14px' }}>← Back</button>
      <div style={{ display: 'flex', gap: 'clamp(24px,4vw,54px)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 280, aspectRatio: '4/5', borderRadius: 18, overflow: 'hidden', background: '#EFE7E1' }}>
          {family.photos[0]
            ? <img src={family.photos[0]} alt={family.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'rgba(51,59,71,.4)' }}>{family.title}</div>}
        </div>

        <div style={{ flex: '1 1 340px', minWidth: 290 }}>
          <div style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--pink)' }}>{family.tag}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,3.4vw,38px)', margin: '8px 0 0' }}>{family.title}</h1>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginTop: 16 }}>
            <span style={{ fontSize: 27, fontWeight: 500 }}>{INR(activeVariant?.online_price ?? activeVariant?.unit_price ?? family.price)}</span>
            {family.was && <span style={{ fontSize: 16, color: 'rgba(51,59,71,.42)', textDecoration: 'line-through' }}>{INR(family.was)}</span>}
          </div>
          {family.description && <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(51,59,71,.7)', marginTop: 14 }}>{family.description}</p>}

          {family.colours.length > 1 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(51,59,71,.55)', marginBottom: 11 }}>Colour</div>
              <ColourSwatches colours={family.colours} selected={colour} onSelect={c => { setColour(c); setSize(null) }} />
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(51,59,71,.55)' }}>Select size</span>
              <button type="button" onClick={() => setShowChart(s => !s)} style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'var(--pink)', cursor: 'pointer', textDecoration: 'underline' }}>Size & fit chart</button>
            </div>
            <SizePicker sizes={ALL_SIZES} availableSizes={availableSizes} selected={size} onSelect={setSize} />
          </div>

          {showChart && (
            <div style={{ marginTop: 16, border: '1px solid rgba(51,59,71,.12)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: 'var(--blush)', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--pink)' }}>
                <span style={{ padding: '10px 12px' }}>Size</span><span style={{ padding: '10px 12px' }}>Bust</span><span style={{ padding: '10px 12px' }}>Waist</span><span style={{ padding: '10px 12px' }}>Hip</span>
              </div>
              {SIZE_CHART_ROWS.map(r => (
                <div key={r.size} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 13.5, borderTop: '1px solid rgba(51,59,71,.07)' }}>
                  <span style={{ padding: '9px 12px', fontWeight: 500 }}>{r.size}</span><span style={{ padding: '9px 12px', color: 'rgba(51,59,71,.7)' }}>{r.bust}</span><span style={{ padding: '9px 12px', color: 'rgba(51,59,71,.7)' }}>{r.waist}</span><span style={{ padding: '9px 12px', color: 'rgba(51,59,71,.7)' }}>{r.hip}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <QtyStepper qty={qty} onChange={n => setQty(Math.max(1, n))} />
            <button type="button" onClick={() => handleAdd(false)} className="btn-pill btn-primary" style={{ flex: '1 1 220px', minHeight: 52 }}>Add to bag</button>
            <button type="button" onClick={() => handleAdd(true)} className="btn-pill" style={{ flex: '1 1 160px', minHeight: 52, border: '1px solid var(--navy)', background: 'transparent', color: 'var(--navy)' }}>Buy it now</button>
          </div>

          <Accordion items={PDP_ACCORDION} />
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 60 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26, margin: '0 0 18px' }}>Complete the look</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(clamp(150px,calc((100% - 60px)/4),100%),1fr))', gap: 18 }}>
            {related.map(f => <ProductCard key={f.familyId} family={f} />)}
          </div>
        </section>
      )}
      <Toast text={text} />
    </main>
  )
}
