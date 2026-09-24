import { Link } from 'react-router-dom'
import { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { useCatalog } from '../hooks/useCatalog'
import { ProductCard } from '../components/ProductCard'
import { FIT_GUIDE, REVIEWS, FEATURE_STRIP } from '../config/content'

export function HomePage() {
  const { settings } = useWebsiteSettings()
  const { families, featured, bestsellers, loading } = useCatalog()

  const heroBanner = settings.hero_banners?.[0] || settings.hero_banner_url
  const newArrivals = (featured.length ? featured : families).slice(0, 8)

  return (
    <>
      <section className="container" style={{ padding: '18px 24px 0' }}>
        <div style={{
          position: 'relative', borderRadius: 30, overflow: 'hidden',
          background: 'linear-gradient(115deg,#D2418C 0%,#C42A78 46%,#9E1E5C 100%)',
          color: '#fff', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', minHeight: 480
        }}>
          <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, padding: 'clamp(36px,5vw,72px)' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,255,255,.18)', padding: '8px 16px', borderRadius: 999, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase' }}>
              {settings.tagline}
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(38px,5.6vw,64px)', lineHeight: 1.05, margin: 0 }}>
              {settings.hero_title}
            </h1>
            <p style={{ margin: 0, maxWidth: '42ch', fontSize: 17, lineHeight: 1.6, fontWeight: 300, color: 'rgba(255,255,255,.9)' }}>
              {settings.hero_subtitle}
            </p>
            <Link to="/shop" className="btn-pill" style={{ background: '#fff', color: 'var(--navy)', alignSelf: 'flex-start' }}>Shop Now</Link>
          </div>
          {heroBanner && (
            <div style={{ flex: '1 1 380px', position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto', aspectRatio: '4/5', padding: 24 }}>
              <img src={heroBanner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 24, boxShadow: '0 30px 60px rgba(88,10,50,.28)' }} />
            </div>
          )}
        </div>
      </section>

      <section className="container" style={{ padding: 'clamp(34px,4vw,56px) 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,250px),1fr))', gap: 14 }}>
          {FEATURE_STRIP.map(f => (
            <div key={f.title} style={{ background: '#fff', border: '1px solid rgba(51,59,71,.07)', borderRadius: 20, padding: '22px 24px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, margin: '0 0 4px' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, fontWeight: 300, color: 'rgba(51,59,71,.62)' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: 'clamp(48px,6vw,84px) 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', margin: 0, color: 'var(--pink)' }}>New Arrivals</h2>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(51,59,71,.5)' }}>Loading...</div>
        ) : newArrivals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(51,59,71,.5)' }}>No products published to the website yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(clamp(150px,calc((100% - 66px)/4),100%),1fr))', gap: 'clamp(14px,2vw,22px)' }}>
            {newArrivals.map(f => <ProductCard key={f.familyId} family={f} />)}
          </div>
        )}
      </section>

      {bestsellers.length > 0 && (
        <section className="container" style={{ padding: 'clamp(48px,6vw,84px) 24px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 30 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', margin: 0, color: 'var(--pink)' }}>Trending Right Now</h2>
            <Link to="/shop" style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--pink)' }}>See all products →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 'clamp(14px,2vw,22px)' }}>
            {bestsellers.slice(0, 4).map(f => <ProductCard key={f.familyId} family={f} />)}
          </div>
        </section>
      )}

      <section className="container" style={{ padding: 'clamp(48px,6vw,84px) 24px 0' }}>
        <div style={{ background: 'var(--blush)', borderRadius: 28, padding: 'clamp(30px,4.5vw,56px)', display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ fontSize: 11.5, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: 12 }}>{FIT_GUIDE.eyebrow}</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,42px)', lineHeight: 1.1, margin: '0 0 12px' }}>{FIT_GUIDE.title}</h2>
            <p style={{ margin: 0, maxWidth: '46ch', fontSize: 15.5, lineHeight: 1.6, fontWeight: 300, color: 'rgba(51,59,71,.7)' }}>{FIT_GUIDE.body}</p>
          </div>
          <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="btn-pill btn-primary">{FIT_GUIDE.cta} →</span>
            <span style={{ fontSize: 12.5, fontWeight: 300, color: 'rgba(51,59,71,.6)', textAlign: 'center' }}>{FIT_GUIDE.note}</span>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: 'clamp(48px,6vw,84px) 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 'clamp(28px,3.4vw,40px)', margin: 0, color: 'var(--pink)' }}>Fit Stories</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,290px),1fr))', gap: 20 }}>
          {REVIEWS.map(r => (
            <figure key={r.name} style={{ margin: 0, background: '#fff', border: '1px solid rgba(51,59,71,.07)', borderRadius: 22, padding: 26 }}>
              <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--pink)', marginBottom: 10 }}>Recent review</div>
              <blockquote style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 300, color: 'rgba(51,59,71,.8)' }}>“{r.quote}”</blockquote>
              <figcaption style={{ marginTop: 16 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(51,59,71,.5)' }}>{r.meta}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  )
}
