import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Product } from '../../types'
import { Search, Barcode, X, Package } from 'lucide-react'

interface Props {
  onSelect: (product: Product) => void
}

export function ProductSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q},serial_barcode.eq.${q}`)
      .limit(8)
    setResults(data || [])
    setShowResults(true)
    setIsLoading(false)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Instant barcode scan — no debounce on Enter
    if (e.key === 'Enter' && query.trim()) {
      clearTimeout(debounceRef.current)
      search(query)
    }
  }

  const handleSelect = (product: Product) => {
    onSelect(product)
    setQuery('')
    setResults([])
    setShowResults(false)
    inputRef.current?.focus()
  }

  return (
    <div className="pos-search">
      <div className="search-input-wrap">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, SKU, or scan barcode…"
          className="search-input"
          autoComplete="off"
        />
        <span className="scan-hint">
          <Barcode size={14} />
          Scan or type
        </span>
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="clear-btn">
            <X size={14} />
          </button>
        )}
      </div>

      {showResults && (
        <div className="search-dropdown">
          {isLoading ? (
            <div className="search-state">
              <div className="spinner" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="search-state muted">No products found</div>
          ) : (
            results.map(p => (
              <button key={p.id} className="search-result-item" onClick={() => handleSelect(p)}>
                <div className="result-img">
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} />
                    : <Package size={18} className="muted" />}
                </div>
                <div className="result-info">
                  <span className="result-name">{p.name}</span>
                  <span className="result-sku">{p.sku}</span>
                </div>
                <div className="result-right">
                  <span className="result-price">₹{p.unit_price.toFixed(2)}</span>
                  <span className={`result-stock ${p.stock_qty <= p.low_stock_alert ? 'low' : ''}`}>
                    {p.stock_qty} left
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
