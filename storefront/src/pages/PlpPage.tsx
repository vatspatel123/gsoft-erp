import { useMemo, useState } from 'react'
import { useCatalog } from '../hooks/useCatalog'
import { ProductCard } from '../components/ProductCard'

type Sort = 'new' | 'low' | 'high'

export function PlpPage() {
  const { families, categories, loading } = useCatalog()
  const [category, setCategory] = useState<string | 'all'>('all')
  const [sort, setSort] = useState<Sort>('new')

  const list = useMemo(() => {
    let out = category === 'all' ? families : families.filter(f => f.category === category)
    if (sort === 'low') out = [...out].sort((a, b) => a.price - b.price)
    if (sort === 'high') out = [...out].sort((a, b) => b.price - a.price)
    return out
  }, [families, category, sort])

  return (
    <main className="container" style={{ padding: '26px 24px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', margin: '12px 0 22px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(30px,4vw,44px)', margin: 0 }}>Shop All</h1>
          <p style={{ margin: '6px 0 0', fontWeight: 300, color: 'rgba(51,59,71,.62)', fontSize: 14.5 }}>{list.length} styles · Sizes L to 7XL</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'rgba(51,59,71,.6)' }}>
          Sort
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} style={{ border: '1px solid rgba(51,59,71,.18)', background: '#fff', borderRadius: 999, padding: '9px 15px', fontSize: 13, color: 'var(--navy)' }}>
            <option value="new">Newest first</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <aside style={{ flex: '1 1 200px', maxWidth: 240 }}>
          <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(51,59,71,.5)', marginBottom: 11 }}>Category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button onClick={() => setCategory('all')} style={{
              textAlign: 'left', border: 'none', background: 'transparent', fontSize: 14,
              fontWeight: category === 'all' ? 600 : 400, color: category === 'all' ? 'var(--pink)' : 'var(--navy)',
              padding: '7px 0', cursor: 'pointer'
            }}>All</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                textAlign: 'left', border: 'none', background: 'transparent', fontSize: 14,
                fontWeight: category === c ? 600 : 400, color: category === c ? 'var(--pink)' : 'var(--navy)',
                padding: '7px 0', cursor: 'pointer'
              }}>{c}</button>
            ))}
          </div>
        </aside>

        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'rgba(51,59,71,.5)' }}>Loading...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(51,59,71,.5)' }}>No products in this category yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(clamp(150px,calc((100% - 48px)/3),100%),1fr))', gap: 'clamp(14px,2vw,20px)' }}>
              {list.map(f => <ProductCard key={f.familyId} family={f} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
