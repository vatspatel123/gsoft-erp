import { useState, useRef, useEffect } from 'react'
import { Layout } from '../components/shared/Layout'
import { useWholesale } from '../hooks/useWholesale'
import { printWholesaleBill, sendWholesaleWhatsApp } from '../utils/printWholesaleBill'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  Search, X, Printer, Check,
  Trash2, Truck, FileText
} from 'lucide-react'

// ─── Blue theme tokens ────────────────────────────────────────────────────────
const B = {
  primary:   '#1d4ed8',
  light:     '#dbeafe',
  border:    '#bfdbfe',
  hover:     '#eff6ff',
  text:      '#1e3a8a',
  muted:     '#64748b',
  bg:        '#f0f6ff',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: `1px solid ${B.border}`, borderRadius: '8px',
  padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#1a0a2e', background: 'white', boxSizing: 'border-box',
}

// ─── Party search ─────────────────────────────────────────────────────────────
function PartySearch({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newParty, setNewParty] = useState({ name: '', business_name: '', phone: '', gstin: '', city: '', address: '' })

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setShow(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('wholesale_customers')
          .select('*')
          .or(`name.ilike.%${q}%,business_name.ilike.%${q}%,phone.ilike.%${q}%,gstin.ilike.%${q}%`)
          .eq('is_active', true)
          .order('name').limit(8)
        setResults(data || [])
        setShow(true)
      } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const handleSaveNew = async () => {
    if (!newParty.name.trim()) { toast.error('Party name required'); return }
    const { data, error } = await supabase
      .from('wholesale_customers')
      .insert({
        name: newParty.name.trim(),
        business_name: newParty.business_name.trim() || newParty.name.trim(),
        phone: newParty.phone.trim() || null,
        gstin: newParty.gstin.trim() || null,
        city: newParty.city.trim() || null,
        address: newParty.address.trim() || null,
      })
      .select().single()
    if (error) { toast.error('Error saving party'); return }
    if (data) { onSelect(data); toast.success('Party saved!') }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'white', border: `1px solid ${show ? B.primary : B.border}`,
        borderRadius: '10px', padding: '0 12px',
        boxShadow: show ? `0 0 0 3px ${B.light}` : 'none', transition: 'all 0.15s'
      }}>
        <Search size={14} color={B.primary} />
        <input
          type="text" value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          placeholder="Search party by name, phone or GSTIN..."
          style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 0', fontSize: '13px', fontFamily: 'DM Sans', background: 'transparent', color: '#1a0a2e' }}
        />
        {loading && <div style={{ width: '14px', height: '14px', border: `2px solid ${B.light}`, borderTopColor: B.primary, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      </div>

      {show && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: `1px solid ${B.border}`, borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(29,78,216,0.12)', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto'
        }}>
          {results.map((p, i) => (
            <div key={p.id}
              onMouseDown={() => { onSelect(p); setQ(''); setShow(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < results.length - 1 ? `1px solid ${B.hover}` : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
              onMouseEnter={e => (e.currentTarget.style.background = B.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: B.light, color: B.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                {(p.business_name || p.name).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{p.business_name || p.name}</div>
                <div style={{ fontSize: '10px', color: B.muted }}>
                  {p.phone}{p.gstin ? ` · ${p.gstin}` : ''}{p.city ? ` · ${p.city}` : ''}
                </div>
              </div>
              {(p.outstanding_balance || 0) > 0 && (
                <span style={{ fontSize: '10px', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '99px', fontWeight: 600 }}>
                  Due ₹{Number(p.outstanding_balance).toLocaleString('en-IN')}
                </span>
              )}
            </div>
          ))}

          <div
            onMouseDown={() => { setShow(false); setShowNewForm(true) }}
            style={{ padding: '10px 14px', cursor: 'pointer', background: B.light, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: B.primary, fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.background = B.border)}
            onMouseLeave={e => (e.currentTarget.style.background = B.light)}
          >
            + Add new party
          </div>

          {results.length === 0 && !loading && (
            <div style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', color: B.muted }}>No party found</div>
          )}
        </div>
      )}

      {/* New party quick form */}
      {showNewForm && (
        <div style={{ background: '#f8fafc', border: `1px solid ${B.border}`, borderRadius: '12px', padding: '14px', marginTop: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: B.primary, marginBottom: '10px' }}>New Party</div>
          {(['name', 'business_name', 'phone', 'gstin', 'city', 'address'] as const).map(field => (
            <input key={field} type="text" placeholder={field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              value={newParty[field]} onChange={e => setNewParty(p => ({ ...p, [field]: e.target.value }))}
              style={{ ...inputStyle, marginBottom: '7px' }} />
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={handleSaveNew} style={{ flex: 1, background: B.primary, color: 'white', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>Save Party</button>
            <button onClick={() => setShowNewForm(false)} style={{ background: 'white', color: B.muted, border: `1px solid ${B.border}`, borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Product search ───────────────────────────────────────────────────────────
function ProductSearchBar({ onAdd }: { onAdd: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); setShow(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${q}%,sku.ilike.%${q}%,design_no.ilike.%${q}%,barcode.ilike.%${q}%`)
          .eq('is_active', true)
          .limit(10)
        setResults(data || [])
        setShow(true)
      } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results.length === 1) { onAdd(results[0]); setQ(''); setResults([]); setShow(false) }
    }
    if (e.key === 'Escape') { setShow(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'white', border: `1px solid ${show ? B.primary : B.border}`,
        borderRadius: '10px', padding: '0 14px',
        boxShadow: show ? `0 0 0 3px ${B.light}` : 'none', transition: 'all 0.15s'
      }}>
        <Search size={15} color={B.primary} />
        <input
          ref={inputRef} type="text" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          placeholder="Search products by name, SKU, design or scan barcode..."
          style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 0', fontSize: '14px', fontFamily: 'DM Sans', background: 'transparent', color: '#1a0a2e' }}
        />
        {loading && <div style={{ width: '14px', height: '14px', border: `2px solid ${B.light}`, borderTopColor: B.primary, borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      </div>

      {show && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: `1px solid ${B.border}`, borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(29,78,216,0.12)', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto'
        }}>
          {results.map((p, i) => {
            const wsPrice = Number(p.wholesale_price) || Number(p.unit_price) || 0
            const detail = [p.design_no, p.size, p.colour].filter(Boolean).join(' · ')
            return (
              <div key={p.id}
                onMouseDown={() => { onAdd(p); setQ(''); setResults([]); setShow(false); inputRef.current?.focus() }}
                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: i < results.length - 1 ? `1px solid ${B.hover}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = B.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{p.name}</div>
                  {detail && <div style={{ fontSize: '10px', color: B.primary, marginTop: '1px' }}>{detail}</div>}
                  <div style={{ fontSize: '10px', color: B.muted, fontFamily: 'DM Mono, monospace' }}>{p.sku}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: B.primary, fontFamily: 'DM Mono, monospace' }}>₹{wsPrice.toFixed(0)}</div>
                  {p.mrp && p.mrp !== wsPrice && <div style={{ fontSize: '10px', color: B.muted, textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>MRP ₹{p.mrp}</div>}
                  <div style={{ fontSize: '10px', color: p.stock_qty <= p.low_stock_alert ? '#ef4444' : '#16a34a' }}>{p.stock_qty} pcs</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ saleData, onNewSale, onClose }: { saleData: any; onNewSale: () => void; onClose: () => void }) {
  const [sent, setSent] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'DM Sans, sans-serif' }}
        onClick={e => e.stopPropagation()}>

        {/* Success badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: B.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Check size={28} strokeWidth={3} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Sale Complete!</div>
          <div style={{ fontSize: '13px', color: B.muted, marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>{saleData.invoiceNo}</div>
        </div>

        {/* Quick summary */}
        <div style={{ background: B.bg, border: `1px solid ${B.border}`, borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: B.muted }}>Party</span>
            <span style={{ fontWeight: 600, color: '#1a0a2e' }}>{saleData.party?.business_name || saleData.party?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: B.muted }}>Items</span>
            <span style={{ fontWeight: 600, color: '#1a0a2e' }}>{saleData.cart.length} products</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, borderTop: `1px solid ${B.border}`, paddingTop: '8px', marginTop: '4px' }}>
            <span style={{ color: B.primary }}>Net Payable</span>
            <span style={{ color: B.primary, fontFamily: 'DM Mono, monospace' }}>₹{saleData.netAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery options */}
        <div style={{ background: '#f8fafc', border: `1px solid ${B.border}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: B.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Send Invoice</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

            <button onClick={() => printWholesaleBill(saleData)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', border: `1px solid ${B.border}`, borderRadius: '10px', padding: '11px 14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = B.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = B.border)}>
              <Printer size={18} color={B.primary} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>Print A4 Invoice</div>
                <div style={{ fontSize: '10px', color: B.muted }}>Full GST invoice with party details</div>
              </div>
            </button>

            {saleData.party?.phone && (
              <button onClick={() => { sendWholesaleWhatsApp(saleData); setSent(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '11px 14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <span style={{ fontSize: '18px' }}>💬</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#15803d' }}>Send WhatsApp</div>
                  <div style={{ fontSize: '10px', color: '#86efac' }}>{saleData.party.phone}</div>
                </div>
                {sent && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: '99px' }}>✓ Sent</span>}
              </button>
            )}

            <button onClick={async () => { printWholesaleBill(saleData); await new Promise(r => setTimeout(r, 500)); sendWholesaleWhatsApp(saleData); setSent(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: `1px solid ${B.border}`, borderRadius: '10px', padding: '11px 14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <span style={{ fontSize: '18px' }}>🖨️💬</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>Print + WhatsApp</div>
                <div style={{ fontSize: '10px', color: B.muted }}>Both at once</div>
              </div>
            </button>
          </div>
        </div>

        <button onClick={() => { onNewSale(); onClose() }}
          style={{ width: '100%', background: B.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
          + New Wholesale Bill
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function WholesalePage() {
  const ws = useWholesale()
  const [showSuccess, setShowSuccess] = useState(false)

  const sectionLabel = (label: string) => (
    <div style={{ fontSize: '10px', fontWeight: 700, color: B.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
      {label}
    </div>
  )

  const handleComplete = async () => {
    const sale = await ws.completeSale()
    if (sale) setShowSuccess(true)
  }

  const canComplete = ws.cart.length > 0 && !ws.isSaving && !!ws.party

  return (
    <Layout>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'DM Sans, sans-serif', background: B.bg }}>

        {/* ── Left: Product cart ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${B.border}` }}>

          {/* Header */}
          <div style={{ padding: '16px 20px', background: B.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Wholesale Billing</div>
              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '1px' }}>
                {ws.cart.length > 0 ? `${ws.cart.length} product${ws.cart.length !== 1 ? 's' : ''} in cart` : 'Add products to start'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 600 }}>
                WS Invoice
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${B.border}`, background: 'white', flexShrink: 0 }}>
            <ProductSearchBar onAdd={ws.addToCart} />
          </div>

          {/* Cart table */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
            {ws.cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: B.muted }}>
                <FileText size={48} color={B.border} style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: 500, color: B.muted }}>Cart is empty</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Search and add products above</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                    <th style={thS}>#</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Product</th>
                    <th style={thS}>Qty</th>
                    <th style={thS}>W.Price</th>
                    <th style={thS}>Disc%</th>
                    <th style={thS}>GST%</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Amount</th>
                    <th style={thS}></th>
                  </tr>
                </thead>
                <tbody>
                  {ws.cart.map((item, idx) => {
                    const fashionDetail = [item.product.design_no, item.product.size, item.product.colour].filter(Boolean).join(' · ')
                    return (
                      <tr key={item.product.id} style={{ borderBottom: `1px solid #f1f5f9` }}
                        onMouseEnter={e => (e.currentTarget.style.background = B.hover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: B.muted, width: '32px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: 500, color: '#1a0a2e' }}>{item.product.name}</div>
                          {fashionDetail && <div style={{ fontSize: '10px', color: B.primary, marginTop: '1px' }}>{fashionDetail}</div>}
                          <div style={{ fontSize: '10px', color: B.muted, fontFamily: 'DM Mono, monospace' }}>{item.product.sku}</div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button onClick={() => ws.updateQty(item.product.id, item.qty - 1)} style={qtyBtnStyle}>−</button>
                            <input
                              type="number" value={item.qty} min={1}
                              onChange={e => ws.updateQty(item.product.id, parseInt(e.target.value) || 1)}
                              style={{ width: '44px', textAlign: 'center', border: `1px solid ${B.border}`, borderRadius: '6px', padding: '4px', fontSize: '12px', fontFamily: 'DM Mono, monospace', color: '#1a0a2e', outline: 'none' }}
                            />
                            <button onClick={() => ws.updateQty(item.product.id, item.qty + 1)} style={qtyBtnStyle}>+</button>
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <input
                            type="number" value={item.unit_price}
                            onChange={e => ws.updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '70px', textAlign: 'right', border: `1px solid ${B.border}`, borderRadius: '6px', padding: '4px 6px', fontSize: '12px', fontFamily: 'DM Mono, monospace', color: B.primary, fontWeight: 600, outline: 'none' }}
                          />
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                          <input
                            type="number" value={item.discount_pct} min={0} max={100}
                            onChange={e => ws.updateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '52px', textAlign: 'center', border: `1px solid ${B.border}`, borderRadius: '6px', padding: '4px', fontSize: '12px', fontFamily: 'DM Mono, monospace', color: '#1a0a2e', outline: 'none' }}
                          />
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', color: B.muted, fontFamily: 'DM Mono, monospace' }}>
                          {item.gst_rate}%
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: B.primary, fontFamily: 'DM Mono, monospace' }}>
                          ₹{item.line_total.toFixed(2)}
                          {item.taxable_amount !== item.line_total && (
                            <div style={{ fontSize: '9px', color: B.muted, fontWeight: 400 }}>Taxable ₹{item.taxable_amount.toFixed(0)}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button onClick={() => ws.removeItem(item.product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Party + Bill totals ─────────────────────────────────── */}
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', background: 'white', flexShrink: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* Party section */}
            <div style={{ marginBottom: '16px' }}>
              {sectionLabel('Party / Customer')}
              {ws.party ? (
                <div style={{ background: B.light, border: `1px solid ${B.border}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: B.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, flexShrink: 0 }}>
                    {(ws.party.business_name || ws.party.name).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{ws.party.business_name || ws.party.name}</div>
                    <div style={{ fontSize: '10px', color: B.muted }}>
                      {ws.party.phone}{ws.party.gstin ? ` · ${ws.party.gstin}` : ''}
                    </div>
                    {(ws.party.outstanding_balance || 0) > 0 && (
                      <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>⚠ Outstanding: ₹{Number(ws.party.outstanding_balance).toLocaleString('en-IN')}</div>
                    )}
                  </div>
                  <button onClick={() => ws.setParty(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.muted, padding: '2px', fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <PartySearch onSelect={ws.setParty} />
              )}
            </div>

            {/* GST Type */}
            <div style={{ marginBottom: '14px' }}>
              {sectionLabel('GST Type')}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['gst', 'igst'] as const).map(type => (
                  <button key={type} onClick={() => ws.setGstType(type)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: ws.gstType === type ? 'none' : `1px solid ${B.border}`, background: ws.gstType === type ? B.primary : 'white', color: ws.gstType === type ? 'white' : B.muted, fontFamily: 'DM Sans', transition: 'all 0.15s' }}>
                    {type === 'gst' ? 'CGST + SGST' : 'IGST'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bill discount + freight */}
            <div style={{ marginBottom: '14px' }}>
              {sectionLabel('Bill Discount & Freight')}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: B.muted, marginBottom: '4px' }}>Discount %</div>
                  <input type="number" value={ws.discountPct} min={0} max={100}
                    onChange={e => ws.setDiscountPct(parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, fontFamily: 'DM Mono, monospace' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: B.muted, marginBottom: '4px' }}>Freight ₹</div>
                  <input type="number" value={ws.freight} min={0}
                    onChange={e => ws.setFreight(parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, fontFamily: 'DM Mono, monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* Payment mode */}
            <div style={{ marginBottom: '14px' }}>
              {sectionLabel('Payment Mode')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {([
                  { mode: 'cash', label: '💵 Cash' },
                  { mode: 'upi', label: '📱 UPI' },
                  { mode: 'credit', label: '📒 Credit' },
                  { mode: 'cheque', label: '📋 Cheque' },
                ] as const).map(({ mode, label }) => (
                  <button key={mode} onClick={() => ws.setPaymentMode(mode)}
                    style={{ padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: ws.paymentMode === mode ? 600 : 400, cursor: 'pointer', border: ws.paymentMode === mode ? 'none' : `1px solid ${B.border}`, background: ws.paymentMode === mode ? B.primary : 'white', color: ws.paymentMode === mode ? 'white' : B.muted, fontFamily: 'DM Sans', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '14px' }}>
              {sectionLabel('Notes (optional)')}
              <textarea value={ws.notes} onChange={e => ws.setNotes(e.target.value)}
                placeholder="Delivery terms, transport details..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* ── Totals + Complete ─────────────────────────────────────── */}
          <div style={{ padding: '14px 16px', borderTop: `1px solid ${B.border}`, background: '#f8fafc', flexShrink: 0 }}>
            {[
              { label: 'Subtotal', val: ws.subtotal },
              ...(ws.billDiscAmt > 0 ? [{ label: `Discount (${ws.discountPct}%)`, val: -ws.billDiscAmt, color: '#16a34a' }] : []),
              ...(ws.gstType === 'gst'
                ? [{ label: 'CGST', val: ws.gstAmount / 2 }, { label: 'SGST', val: ws.gstAmount / 2 }]
                : [{ label: 'IGST', val: ws.gstAmount }]),
              ...(ws.freight > 0 ? [{ label: 'Freight', val: ws.freight }] : []),
              ...(Math.abs(ws.roundOff) > 0.001 ? [{ label: 'Round Off', val: ws.roundOff }] : []),
            ].map(({ label, val, color }: any) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px', color: color || B.muted }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'DM Mono, monospace' }}>{val < 0 ? '-' : ''}₹{Math.abs(val).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: B.primary, borderTop: `2px solid ${B.border}`, paddingTop: '8px', marginTop: '6px', marginBottom: '12px' }}>
              <span>Net Payable</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>₹{ws.netAmount.toFixed(2)}</span>
            </div>

            <button
              onClick={handleComplete}
              disabled={!canComplete}
              style={{ width: '100%', padding: '13px', background: canComplete ? B.primary : '#bfdbfe', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: canComplete ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {ws.isSaving ? 'Saving...' : (
                <>
                  <Truck size={16} />
                  Complete Bill · <span style={{ fontFamily: 'DM Mono, monospace' }}>₹{ws.netAmount.toFixed(2)}</span>
                </>
              )}
            </button>

            {!ws.party && ws.cart.length > 0 && (
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#ef4444', marginTop: '6px' }}>
                Select a party to complete billing
              </div>
            )}

            <button onClick={ws.clearCart}
              style={{ width: '100%', marginTop: '8px', padding: '9px', background: 'transparent', border: `1px solid ${B.border}`, color: B.muted, borderRadius: '10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Trash2 size={13} /> Clear Bill
            </button>
          </div>
        </div>

        {showSuccess && ws.lastSale && (
          <SuccessModal
            saleData={ws.lastSale}
            onNewSale={ws.clearCart}
            onClose={() => setShowSuccess(false)}
          />
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  )
}

const thS: React.CSSProperties = {
  padding: '10px 8px', textAlign: 'center', fontSize: '10px',
  fontWeight: 700, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
}
const qtyBtnStyle: React.CSSProperties = {
  width: '24px', height: '24px', border: `1px solid ${B.border}`, borderRadius: '6px',
  background: 'white', cursor: 'pointer', fontSize: '14px', color: B.primary,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
}
