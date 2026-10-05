import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { saveProductsToCache, searchCachedProducts, isCacheValid, getCachedProducts } from '../../utils/offlineCache'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { colourToCSS as colourCSS } from '../../utils/design'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  unit_price: number
  gst_rate: number
  stock_qty: number
  low_stock_alert: number
  photo_url: string | null
  is_active: boolean
  design_no?: string | null
  size?: string | null
  colour?: string | null
  mrp?: number | null
  batch_no?: string | null
}


interface Props {
  onSelect: (product: Product) => void
  onOpenAddProduct?: (barcode?: string) => void
}

// Group products by base name for size-picker display
function groupProducts(products: Product[]): Array<{ base: string; variants: Product[] }> {
  const map = new Map<string, Product[]>()
  for (const p of products) {
    const existing = map.get(p.name) || []
    map.set(p.name, [...existing, p])
  }
  return Array.from(map.entries()).map(([base, variants]) => ({ base, variants }))
}

export function ProductSearch({ onSelect, onOpenAddProduct }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanFlash, setScanFlash] = useState<'' | 'success' | 'error'>('')
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isOnline = useOnlineStatus()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const playBeep = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = success ? 1200 : 400
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) {
      // Audio not available
    }
  }

  const handleBarcodeSearch = async (code: string) => {
    if (!code || !code.trim()) return
    const searchCode = code.trim()
    const searchLower = searchCode.toLowerCase()
    console.log('=== SEARCH / SCAN INPUT ===', searchCode)

    setLoading(true)
    try {
      let candidateList: any[] = []

      if (navigator.onLine) {
        try {
          const { data } = await supabase
            .from('products')
            .select('*, categories(name)')
          if (data && data.length > 0) candidateList = data
        } catch (dbErr) {
          console.warn('DB fetch error during search, using cache:', dbErr)
        }
      }

      if (candidateList.length === 0) {
        candidateList = getCachedProducts() || []
      }

      // 1. Case-insensitive exact match on barcode, SKU, design_no, batch_no, pcode
      let match = candidateList.find(p =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === searchLower) ||
        (p.sku && String(p.sku).trim().toLowerCase() === searchLower) ||
        (p.design_no && String(p.design_no).trim().toLowerCase() === searchLower) ||
        (p.batch_no && String(p.batch_no).trim().toLowerCase() === searchLower) ||
        (p.pcode && String(p.pcode).trim().toLowerCase() === searchLower)
      )

      // 2. Partial match on name, SKU, design_no if no exact code match
      if (!match) {
        const matches = candidateList.filter(p =>
          p.is_active !== false && (
            (p.name && p.name.toLowerCase().includes(searchLower)) ||
            (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
            (p.design_no && p.design_no.toLowerCase().includes(searchLower)) ||
            (p.categories?.name && p.categories.name.toLowerCase().includes(searchLower))
          )
        )

        if (matches.length === 1) {
          match = matches[0]
        } else if (matches.length > 1) {
          setResults(matches)
          setShow(true)
          setLoading(false)
          return
        }
      }

      if (match) {
        console.log('SUCCESS - selecting product:', match.name)
        handleSelect(match)
        setScanFlash('success')
        setTimeout(() => setScanFlash(''), 500)
        playBeep(true)
        toast.success(`${match.name} scanned!`)
        return
      }

      // Nothing found
      setScanFlash('error')
      setTimeout(() => setScanFlash(''), 800)
      playBeep(false)

      toast.error(`Not found: [${code}]`, { duration: 4000 })

      if (onOpenAddProduct) {
        toast((t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 500, fontSize: '13px' }}>Product not found: {code}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { toast.dismiss(t.id); onOpenAddProduct(code) }}
                style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                + Add Product
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                style={{ background: '#f5f3ff', color: '#9333ea', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 5000 })
      }
    } catch (e) {
      console.error('Scan error:', e)
    } finally {
      setLoading(false)
    }
  }

  const search = async (q: string) => {
    if (!q || q.trim().length === 0) { setResults([]); setShow(false); return }
    const searchStr = q.trim().toLowerCase()
    setLoading(true)
    try {
      let fetched: Product[] = []
      if (navigator.onLine) {
        try {
          // Typing a category ("kurtis", "3 pc") lists that category's pieces too.
          const { data: cats } = await supabase.from('categories').select('id').ilike('name', `%${searchStr}%`)
          const catIds = (cats || []).map(c => c.id)
          const { data, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .or(`name.ilike.%${searchStr}%,sku.ilike.%${searchStr}%,design_no.ilike.%${searchStr}%,batch_no.ilike.%${searchStr}%,barcode.ilike.%${searchStr}%,pcode.ilike.%${searchStr}%` +
              (catIds.length ? `,category_id.in.(${catIds.join(',')})` : ''))
            .eq('is_active', true)
            .limit(catIds.length ? 50 : 12)
          if (!error && data) {
            fetched = data
            saveProductsToCache(data)
          }
        } catch (dbErr) {
          console.warn('DB search error, using cache:', dbErr)
        }
      }

      const cached = searchCachedProducts(searchStr, 50)
      const map = new Map<string, Product>()
      for (const p of cached) map.set(p.id, p)
      for (const p of fetched) map.set(p.id, p)

      const merged = Array.from(map.values())
      setResults(merged)
      setShow(merged.length > 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    // Debounce manual typing
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => search(val), 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = query.trim()
      console.log('Enter pressed, value:', val)
      if (!val) return
      // Clear debounce — scanner wins
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      setQuery('')
      setResults([])
      setShow(false)
      handleBarcodeSearch(val)
      return
    }
    // Arrow keys to navigate dropdown (optional quality-of-life)
    if (e.key === 'Escape') {
      setShow(false)
      setQuery('')
      setResults([])
    }
  }

  const handleSelect = (p: Product) => {
    onSelect(p)
    setQuery('')
    setResults([])
    setShow(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const borderColor =
    scanFlash === 'success' ? '#16a34a' :
    scanFlash === 'error' ? '#ef4444' :
    show || inputFocused ? '#c084fc' : '#f3e8ff'

  const groups = groupProducts(results)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', background: 'white',
        border: `1px solid ${borderColor}`,
        borderRadius: '12px', padding: '0 16px',
        boxShadow: inputFocused ? '0 0 0 3px #f5f3ff' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.15s'
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9333ea" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l2.5 2.5"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          data-enter="own"
          onKeyDown={handleKeyDown}
          onFocus={() => { setInputFocused(true); if (results.length > 0) setShow(true) }}
          onBlur={() => { setInputFocused(false); setTimeout(() => setShow(false), 200) }}
          placeholder="Search by name, SKU, design no or scan barcode..."
          style={{
            flex: 1, border: 'none', outline: 'none',
            padding: '12px 0', fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            background: 'transparent', color: '#1a0a2e'
          }}
        />
        {loading && (
          <div style={{ width: '14px', height: '14px', border: '2px solid #f3e8ff', borderTopColor: '#9333ea', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        )}
      </div>

      {/* Scanner status indicator */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          marginTop: '5px', fontSize: '11px',
          color: inputFocused ? '#16a34a' : '#94a3b8',
          cursor: 'pointer', userSelect: 'none'
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: inputFocused ? '#16a34a' : '#94a3b8',
          transition: 'background 0.3s'
        }} />
        {inputFocused
          ? 'Scanner Ready — Point and scan'
          : 'Click here to activate scanner'}
      </div>

      {/* Dropdown */}
      {show && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: '1px solid #f3e8ff', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(147,51,234,0.12)', overflow: 'hidden',
          maxHeight: '380px', overflowY: 'auto'
        }}>
          {groups.map((group, gi) => {
            const isGroup = group.variants.length > 1
            return (
              <div key={group.base + gi}>
                {isGroup ? (
                  <div>
                    <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fdf8ff', borderBottom: '1px solid #f5f3ff' }}>
                      {group.base}
                    </div>
                    {group.variants.map((p, vi) => (
                      <div key={p.id}
                        onMouseDown={e => { e.preventDefault(); handleSelect(p) }}
                        style={{
                          padding: '8px 16px 8px 28px', cursor: 'pointer',
                          borderBottom: vi < group.variants.length - 1 ? '1px solid #fdf8ff' : gi < groups.length - 1 ? '1px solid #f3e8ff' : 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {vi < group.variants.length - 1 ? '├──' : '└──'}
                          </span>
                          {p.size && (
                            <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: 700 }}>{p.size}</span>
                          )}
                          {p.colour && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourCSS(p.colour), border: '1px solid rgba(0,0,0,0.1)' }} />
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{p.colour}</span>
                            </div>
                          )}
                          {p.design_no && <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>D:{p.design_no}</span>}
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '10px', color: p.stock_qty <= p.low_stock_alert ? '#ef4444' : '#16a34a' }}>
                            {p.stock_qty} pcs
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>₹{p.unit_price.toFixed(0)}</div>
                            {p.mrp && p.mrp !== p.unit_price && (
                              <div style={{ fontSize: '10px', color: '#94a3b8', textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>₹{p.mrp}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onMouseDown={e => { e.preventDefault(); handleSelect(group.variants[0]) }}
                    style={{
                      padding: '10px 16px', cursor: 'pointer',
                      borderBottom: gi < groups.length - 1 ? '1px solid #fdf8ff' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    {renderSingleProduct(group.variants[0])}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {show && results.length === 0 && query.length > 0 && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: '1px solid #f3e8ff', borderRadius: '12px',
          padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px'
        }}>
          No products found for "{query}"
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function renderSingleProduct(p: Product) {
  const fashionDetails = [
    p.design_no ? `Design: ${p.design_no}` : null,
    p.size || null,
    p.colour || null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{p.name}</div>
        {fashionDetails && (
          <div style={{ fontSize: '11px', color: '#9333ea', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {p.colour && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourCSS(p.colour), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />}
            {fashionDetails}
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'DM Mono, monospace' }}>
          {p.sku}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>₹{p.unit_price.toFixed(0)}</div>
        {p.mrp && p.mrp !== p.unit_price && (
          <div style={{ fontSize: '10px', color: '#94a3b8', textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>MRP ₹{p.mrp}</div>
        )}
        <div style={{ fontSize: '10px', marginTop: '2px', color: p.stock_qty <= p.low_stock_alert ? '#ef4444' : '#16a34a' }}>
          {p.stock_qty <= p.low_stock_alert ? '⚠ Low stock' : '✓ In stock'}
        </div>
      </div>
    </>
  )
}

export default ProductSearch
