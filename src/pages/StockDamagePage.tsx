import { useState, useEffect, useMemo } from 'react'
import { Layout } from '../components/shared/Layout'
import { EmptyState } from '../components/shared/EmptyState'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useInventory } from '../hooks/useInventory'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../utils/exportCSV'
import toast from 'react-hot-toast'
import { PackageX, Search, Download, RotateCcw, AlertTriangle } from 'lucide-react'

const card: React.CSSProperties = {
  background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '20px', marginBottom: '16px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px',
  fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e',
  background: 'white', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '6px', display: 'block'
}
const btnPrimary: React.CSSProperties = {
  background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 18px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  display: 'inline-flex', alignItems: 'center', gap: '6px'
}
const btnOutline: React.CSSProperties = {
  background: 'white', color: '#9333ea', border: '1px solid #c084fc', borderRadius: '10px',
  padding: '10px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '6px'
}

const DAMAGE_REASONS = [
  'Damaged in transit',
  'Torn / Broken',
  'Water or stain damage',
  'Manufacturing defect',
  'Theft / Shrinkage',
  'Sample or display piece',
  'Expired / Unsellable',
  'Other'
]

const GRID = '1.6fr 1fr 0.7fr 0.9fr 1fr 1fr 90px'
const INR = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

// The table stores a positive qty; the direction is in qty_before/qty_after,
// falling back to adjustment_type on older rows that predate those columns.
const change = (r: { qty: number; qty_before: number | null; qty_after: number | null; adjustment_type?: string }) => {
  if (typeof r.qty_before === 'number' && typeof r.qty_after === 'number') return r.qty_after - r.qty_before
  return (r.adjustment_type === 'add' ? 1 : -1) * Math.abs(r.qty || 0)
}

interface DamageRow {
  id: string
  product_id: string
  qty: number
  qty_before: number | null
  qty_after: number | null
  reason: string
  notes: string | null
  adjustment_type: string
  created_at: string
  products?: { name: string; sku: string; cost_price: number | null; size: string | null; colour: string | null } | null
}

export function StockDamagePage() {
  const { allProducts, adjustStock, fetchProducts } = useInventory()

  const [rows, setRows] = useState<DamageRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [confirmReverse, setConfirmReverse] = useState<DamageRow | null>(null)

  // Log-damage form
  const [productQuery, setProductQuery] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState(DAMAGE_REASONS[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // The register needs the full history with filters; useInventory.fetchAdjustments
  // caps at 10 rows, so the page loads its own list but still writes via adjustStock.
  const loadRegister = async () => {
    setLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('stock_damage_log')
        .select('*, products(name, sku, cost_price, size, colour)')
        .order('created_at', { ascending: false })
        .limit(300)
      if (!error && data) setRows(data as DamageRow[])
    } catch (e) {
      console.warn('Damage register load notice:', e)
    } finally {
      setLoadingRows(false)
    }
  }

  useEffect(() => { loadRegister() }, [])

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return []
    return allProducts
      .filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.design_no?.toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [productQuery, allProducts])

  const selectedProduct = allProducts.find((p: any) => p.id === productId)

  const handleLogDamage = async () => {
    if (!productId || !selectedProduct) { toast.error('Select a product first'); return }
    if (qty <= 0) { toast.error('Quantity must be at least 1'); return }
    if (qty > selectedProduct.stock_qty) {
      toast.error(`Only ${selectedProduct.stock_qty} in stock`)
      return
    }
    setSaving(true)
    try {
      // Same shared writer the Inventory module uses, so both log identically.
      await adjustStock(productId, 'remove', qty, reason, notes)
      setProductId(''); setProductQuery(''); setQty(1); setNotes(''); setReason(DAMAGE_REASONS[0])
      await Promise.all([loadRegister(), fetchProducts()])
    } finally {
      setSaving(false)
    }
  }

  const handleReverse = async (row: DamageRow) => {
    const units = Math.abs(change(row))
    await adjustStock(row.product_id, 'add', units, 'Reversal of damage entry', `Reversed log ${row.id.slice(0, 8)}`)
    await Promise.all([loadRegister(), fetchProducts()])
    toast.success(`Reversed — ${units} unit(s) returned to stock`)
  }

  // Only outward movements count as damage/loss; reversals and additions do not.
  const damageRows = rows.filter(r => change(r) < 0)
  const lossValue = (r: DamageRow) => Math.abs(change(r)) * Number(r.products?.cost_price || 0)

  const filtered = damageRows.filter(r => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q ||
      r.products?.name?.toLowerCase().includes(q) ||
      r.products?.sku?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    const matchesReason = reasonFilter === 'all' || r.reason === reasonFilter
    return matchesSearch && matchesReason
  })

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
  const monthRows = damageRows.filter(r => new Date(r.created_at) >= thisMonth)

  const totals = {
    units: damageRows.reduce((s, r) => s + Math.abs(change(r)), 0),
    value: damageRows.reduce((s, r) => s + lossValue(r), 0),
    monthUnits: monthRows.reduce((s, r) => s + Math.abs(change(r)), 0),
    monthValue: monthRows.reduce((s, r) => s + lossValue(r), 0)
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map(r => ({
        date: new Date(r.created_at).toLocaleDateString('en-IN'),
        product: r.products?.name || '—',
        sku: r.products?.sku || '',
        units: Math.abs(change(r)),
        reason: r.reason || '',
        value: lossValue(r).toFixed(2),
        notes: r.notes || ''
      })),
      'stock_damage',
      [
        { key: 'date', label: 'Date' }, { key: 'product', label: 'Product' },
        { key: 'sku', label: 'SKU' }, { key: 'units', label: 'Units Lost' },
        { key: 'reason', label: 'Reason' }, { key: 'value', label: 'Value Lost' },
        { key: 'notes', label: 'Notes' }
      ]
    )
  }

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#fdf8ff', minHeight: '100%', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PackageX size={20} color="#9333ea" />
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Stock Damage & Write-offs</h1>
          </div>
          <button onClick={handleExport} style={btnOutline}><Download size={14} /> Export CSV</button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Units Lost (all time)', value: String(totals.units), color: '#ef4444' },
            { label: 'Value Written Off', value: INR(totals.value), color: '#ef4444' },
            { label: 'Units This Month', value: String(totals.monthUnits), color: '#f59e0b' },
            { label: 'Value This Month', value: INR(totals.monthValue), color: '#f59e0b' }
          ].map(s => (
            <div key={s.label} style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>

          {/* Log damage */}
          <div style={card}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} color="#ef4444" /> Log Damage
            </div>

            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <label style={labelStyle}>Product</label>
              {selectedProduct ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e9d5ff', background: '#fdf8ff', borderRadius: '10px', padding: '10px 12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{selectedProduct.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      In stock: {selectedProduct.stock_qty} · Cost {INR(selectedProduct.cost_price || 0)}
                    </div>
                  </div>
                  <button onClick={() => { setProductId(''); setProductQuery('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
                </div>
              ) : (
                <>
                  <input
                    style={inputStyle}
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                    placeholder="Search product by name, SKU, design no..."
                  />
                  {productMatches.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #f3e8ff', borderRadius: '10px', boxShadow: '0 8px 24px rgba(147,51,234,0.12)', marginTop: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                      {productMatches.map((p: any) => (
                        <div key={p.id}
                          onClick={() => { setProductId(p.id); setProductQuery('') }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #fdf8ff' }}>
                          <div style={{ fontSize: '13px', color: '#1a0a2e' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.sku} · {p.stock_qty} in stock</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Quantity Damaged</label>
              <input type="number" min={1} style={inputStyle} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Reason</label>
              <select style={inputStyle} value={reason} onChange={e => setReason(e.target.value)}>
                {DAMAGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'none' }} value={notes}
                onChange={e => setNotes(e.target.value)} placeholder="Batch, supplier claim reference..." />
            </div>

            {selectedProduct && qty > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#b91c1c' }}>
                Writing off <strong>{qty}</strong> unit(s) · Value{' '}
                <strong style={{ fontFamily: 'DM Mono, monospace' }}>{INR(qty * Number(selectedProduct.cost_price || 0))}</strong>
                <div style={{ marginTop: '2px', color: '#ef4444' }}>
                  Stock {selectedProduct.stock_qty} → {selectedProduct.stock_qty - qty}
                </div>
              </div>
            )}

            <button onClick={handleLogDamage} disabled={saving || !productId}
              style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: saving || !productId ? 0.5 : 1, cursor: saving || !productId ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Log Damage & Reduce Stock'}
            </button>
          </div>

          {/* Register */}
          <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '10px', padding: '14px 16px', borderBottom: '1px solid #f3e8ff', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '180px' }}>
                <Search size={14} color="#9333ea" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or reason..."
                  style={{ ...inputStyle, border: 'none', padding: '4px 0' }} />
              </div>
              <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
                style={{ ...inputStyle, width: 'auto', padding: '7px 12px' }}>
                <option value="all">All reasons</option>
                {DAMAGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 16px', borderBottom: '1px solid #f3e8ff', fontSize: '10px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div>Product</div><div>Reason</div><div style={{ textAlign: 'right' }}>Units</div>
              <div style={{ textAlign: 'right' }}>Value</div><div>Stock After</div><div>Date</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>

            {loadingRows ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading register...</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="📦"
                title={damageRows.length === 0 ? 'No damage recorded' : 'No entries match your filters'}
                subtitle={damageRows.length === 0 ? 'Logged damage and write-offs will appear here.' : 'Try a different reason or search term.'}
              />
            ) : (
              filtered.map(r => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid #fdf8ff', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1a0a2e' }}>{r.products?.name || 'Unknown product'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {r.products?.sku}
                      {r.products?.size ? ` · ${r.products.size}` : ''}
                      {r.products?.colour ? ` · ${r.products.colour}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {r.reason}
                    {r.notes && <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{r.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: '#ef4444', fontWeight: 700 }}>
                    −{Math.abs(change(r))}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: '#ef4444' }}>{INR(lossValue(r))}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{r.qty_after}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={() => setConfirmReverse(r)} title="Reverse entry"
                      style={{ border: '1px solid #e5e7eb', background: 'white', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', lineHeight: 0 }}>
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmReverse}
        title="Reverse this write-off?"
        message={`${confirmReverse ? Math.abs(change(confirmReverse)) : 0} unit(s) of ${confirmReverse?.products?.name || 'this product'} will be added back to stock, and the reversal is recorded in the log.`}
        confirmLabel="Reverse"
        confirmColor="purple"
        onConfirm={async () => { if (confirmReverse) await handleReverse(confirmReverse); setConfirmReverse(null) }}
        onCancel={() => setConfirmReverse(null)}
      />
    </Layout>
  )
}
