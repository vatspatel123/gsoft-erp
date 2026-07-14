import { useState, useEffect, useRef } from 'react'
import { Layout } from '../components/shared/Layout'
import { usePurchaseEntry } from '../hooks/usePurchaseEntry'
import { PrintLabelsModal } from '../components/inventory/PrintLabelsModal'
import { supabase } from '../lib/supabase'
import {
  Search, X, Plus, Trash2, ChevronDown,
  ShoppingBag, Printer, Tag, RefreshCw
} from 'lucide-react'

// ─── Green theme tokens ───────────────────────────────────────────────────────
const G = {
  primary:  '#16a34a',
  light:    '#dcfce7',
  border:   '#bbf7d0',
  hover:    '#f0fdf4',
  text:     '#14532d',
  muted:    '#64748b',
  bg:       '#f0fdf4',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '7px 10px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#1a0a2e', background: 'white', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px',
}

const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL','7XL',
  '28','30','32','34','36','38','40','42','44','46','48',
  'Free Size','One Size']
const GST_RATES = [0, 5, 12, 18, 28]

// ─── Product search cell ───────────────────────────────────────────────────────
function ProductCell({
  item,
  onSelect,
  onNameChange,
}: {
  item: any
  onSelect: (product: any) => void
  onNameChange: (name: string) => void
}) {
  const [q, setQ] = useState(item.productName || '')
  const [results, setResults] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item.product) {
      setQ(item.product.name || '')
      setShow(false)
      return
    }
  }, [item.product])

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setShow(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('products')
          .select('id,name,sku,design_no,pcode,size,colour,mrp,unit_price,cost_price,gst_rate,stock_qty,batch_no')
          .or(`name.ilike.%${q}%,sku.ilike.%${q}%,design_no.ilike.%${q}%,barcode.ilike.%${q}%`)
          .eq('is_active', true)
          .limit(8)
        setResults(data || [])
        setShow(true)
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div style={{ position: 'relative', minWidth: '160px' }}>
      <input
        value={q}
        onChange={e => {
          setQ(e.target.value)
          onNameChange(e.target.value)
          if (item.product) onSelect(null)
        }}
        onFocus={() => results.length > 0 && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        placeholder="Product name..."
        style={{
          ...inputStyle,
          border: item.product ? `1px solid ${G.border}` : '1px solid #e2e8f0',
          background: item.product ? G.hover : 'white',
          paddingRight: '24px',
        }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
          width: '12px', height: '12px', border: `2px solid ${G.light}`, borderTopColor: G.primary,
          borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      )}
      {show && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 9999,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '280px', maxHeight: '240px', overflowY: 'auto'
        }}>
          {results.map(p => (
            <div
              key={p.id}
              onMouseDown={() => { onSelect(p); setQ(p.name); setShow(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
              onMouseEnter={e => (e.currentTarget.style.background = G.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ fontWeight: 500, fontSize: '13px', color: '#1a0a2e' }}>{p.name}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {[p.design_no, p.size, p.colour].filter(Boolean).join(' · ')}
                {p.stock_qty !== null && <span style={{ color: p.stock_qty > 0 ? G.primary : '#ef4444', marginLeft: '6px' }}>
                  Stock: {p.stock_qty}
                </span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Supplier section ─────────────────────────────────────────────────────────
function SupplierSection({
  supplier, setSupplier,
  supplierQuery, setSupplierQuery,
  supplierResults, showSupplierDropdown, setShowSupplierDropdown,
  showNewSupplierForm, setShowNewSupplierForm,
  newSupplier, setNewSupplier,
  saveNewSupplier,
}: any) {
  return (
    <div style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
        Supplier
      </div>

      {supplier ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: G.hover, borderRadius: '10px', padding: '12px 14px', border: `1px solid ${G.border}` }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a0a2e' }}>
              {supplier.business_name || supplier.name}
            </div>
            <div style={{ fontSize: '12px', color: G.muted, marginTop: '3px' }}>
              {supplier.phone && <span>{supplier.phone}</span>}
              {supplier.gstin && <span style={{ marginLeft: '8px' }}>GSTIN: {supplier.gstin}</span>}
            </div>
            {(supplier.outstanding_balance || 0) > 0 && (
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500, marginTop: '3px' }}>
                Outstanding: ₹{(supplier.outstanding_balance || 0).toLocaleString('en-IN')}
              </div>
            )}
          </div>
          <button onClick={() => { setSupplier(null); setSupplierQuery('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'white', border: `1px solid ${showSupplierDropdown ? G.primary : '#e2e8f0'}`,
            borderRadius: '10px', padding: '0 12px',
            boxShadow: showSupplierDropdown ? `0 0 0 3px ${G.light}` : 'none',
          }}>
            <Search size={14} color={G.primary} />
            <input
              type="text" value={supplierQuery}
              onChange={e => setSupplierQuery(e.target.value)}
              onFocus={() => supplierResults.length > 0 && setShowSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
              placeholder="Search supplier by name or phone..."
              style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 0', fontSize: '13px', fontFamily: 'DM Sans', background: 'transparent', color: '#1a0a2e' }}
            />
          </div>

          {showSupplierDropdown && supplierResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(22,163,74,0.12)', overflow: 'hidden', maxHeight: '240px', overflowY: 'auto'
            }}>
              {supplierResults.map((s: any) => (
                <div key={s.id}
                  onMouseDown={() => { setSupplier(s); setSupplierQuery(''); setShowSupplierDropdown(false) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = G.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <div style={{ fontWeight: 500, fontSize: '13px', color: '#1a0a2e' }}>
                    {s.business_name || s.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {s.phone} {s.outstanding_balance > 0 && <span style={{ color: '#ef4444' }}>· Balance: ₹{s.outstanding_balance.toLocaleString('en-IN')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!supplier && (
        <button
          onClick={() => setShowNewSupplierForm(v => !v)}
          style={{ marginTop: '8px', background: 'none', border: 'none', color: G.primary, fontSize: '13px', cursor: 'pointer', padding: '4px 0', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Plus size={14} /> Add New Supplier
        </button>
      )}

      {showNewSupplierForm && !supplier && (
        <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            {[
              { label: 'Owner / Supplier Name *', key: 'name', placeholder: 'e.g. Rajesh Patel' },
              { label: 'Business / Firm Name', key: 'business_name', placeholder: 'e.g. 8I Design Studio' },
              { label: 'Phone', key: 'phone', placeholder: '9876543210' },
              { label: 'GSTIN', key: 'gstin', placeholder: '24AAACR5055K1Z5' },
              { label: 'City', key: 'city', placeholder: 'Surat' },
              { label: 'State', key: 'state', placeholder: 'Gujarat' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  value={(newSupplier as any)[f.key]}
                  onChange={e => setNewSupplier((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>Address</label>
            <textarea
              value={newSupplier.address}
              onChange={e => setNewSupplier((p: any) => ({ ...p, address: e.target.value }))}
              placeholder="Shop / office address"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveNewSupplier}
              style={{ background: G.primary, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
              Save Supplier
            </button>
            <button onClick={() => setShowNewSupplierForm(false)}
              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', color: G.muted }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Success modal ────────────────────────────────────────────────────────────
function SuccessModal({
  purchaseComplete, onClose, onNewPurchase,
}: {
  purchaseComplete: any
  onClose: () => void
  onNewPurchase: () => void
}) {
  const [showLabels, setShowLabels] = useState(false)

  const printBill = () => {
    const w = window.open('', '_blank', 'width=794,height=1123')
    if (!w) return
    const { purchaseNo, bill, items, supplier, netAmount } = purchaseComplete
    const settings = JSON.parse(localStorage.getItem('erp_settings') || '{}')
    const shopName = settings.shopName || 'My Shop'

    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>Purchase Bill - ${purchaseNo}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #1a0a2e; font-size: 13px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .header { text-align: center; margin-bottom: 20px; }
        .divider { border-top: 1px solid #e2e8f0; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-weight: 600; }
        td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
        .total-row td { font-weight: 600; }
        .net-row td { font-size: 15px; font-weight: 700; color: #16a34a; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>${shopName}</h1>
        <div style="font-size:11px;color:#64748b">PURCHASE BILL / INWARD ENTRY</div>
      </div>
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px">
        <div>
          <div><b>Purchase No:</b> ${purchaseNo}</div>
          <div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
          ${bill?.supplier_invoice_no ? `<div><b>Supplier Invoice:</b> ${bill.supplier_invoice_no}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${supplier ? `<div><b>Supplier:</b> ${supplier.business_name || supplier.name}</div>
          ${supplier.phone ? `<div>${supplier.phone}</div>` : ''}
          ${supplier.gstin ? `<div>GSTIN: ${supplier.gstin}</div>` : ''}` : ''}
        </div>
      </div>
      <div class="divider"></div>
      <table>
        <thead><tr>
          <th>#</th><th>Product</th><th>Design</th><th>Size</th><th>Colour</th>
          <th>Batch</th><th>Qty</th><th>Cost</th><th>GST%</th><th>Amount</th>
        </tr></thead>
        <tbody>
          ${items.map((item: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${item.product?.name || item.productName}</td>
              <td>${item.design_no || '—'}</td>
              <td>${item.size || '—'}</td>
              <td>${item.colour || '—'}</td>
              <td>${item.batch_no || '—'}</td>
              <td>${item.qty}</td>
              <td>₹${item.unit_cost}</td>
              <td>${item.gst_rate}%</td>
              <td>₹${item.line_total.toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="divider"></div>
      <div style="display:flex;justify-content:flex-end">
        <table style="width:240px">
          <tr><td>Net Payable</td><td style="text-align:right;font-weight:700;font-size:16px;color:#16a34a">₹${netAmount.toLocaleString('en-IN')}</td></tr>
        </table>
      </div>
      <div class="divider"></div>
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">Stock updated · Generated by GSoft Retail ERP</div>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  // Build products array for label printing
  const labelProducts = (purchaseComplete?.items || []).map((item: any) => ({
    id: item.product?.id || item.id,
    name: item.product?.name || item.productName,
    design_no: item.design_no,
    colour: item.colour,
    size: item.size,
    pcode: item.pcode,
    mrp: item.mrp,
    barcode: item.batch_no || item.product?.barcode || '',
    batch_no: item.batch_no,
    defaultCopies: typeof item.qty === 'number' ? item.qty : 1,
  }))

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', padding: '32px',
          width: '480px', maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Purchase Saved!</div>
            <div style={{ fontSize: '14px', color: G.primary, fontWeight: 600, marginTop: '4px', fontFamily: 'DM Mono' }}>
              {purchaseComplete?.purchaseNo}
            </div>
          </div>

          <div style={{ background: G.hover, borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: G.text, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Stock Updated
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
              {(purchaseComplete?.items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#1a0a2e' }}>
                    {item.product?.name || item.productName}
                    {item.size && <span style={{ color: G.muted }}> {item.size}</span>}
                  </span>
                  <span style={{ color: G.primary, fontWeight: 500 }}>
                    ×{item.qty} ✅
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={printBill}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: 'white', border: `1px solid ${G.border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500, color: G.text }}>
              <Printer size={15} /> Print Purchase Bill (A4)
            </button>
            <button onClick={() => setShowLabels(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', background: 'white', border: `1px solid ${G.border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500, color: G.text }}>
              <Tag size={15} /> Print Barcode Labels
            </button>
            <button onClick={onNewPurchase}
              style={{ width: '100%', padding: '11px', background: G.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
              + New Purchase
            </button>
          </div>
        </div>
      </div>

      {showLabels && (
        <PrintLabelsModal
          products={labelProducts}
          isOpen={showLabels}
          onClose={() => setShowLabels(false)}
        />
      )}
    </>
  )
}

// ─── Purchase History ─────────────────────────────────────────────────────────
function PurchaseHistory({ history, loading, filter, setFilter, onRefresh }: any) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<any[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const loadItems = async (billId: string) => {
    if (expandedId === billId) { setExpandedId(null); return }
    setExpandedId(billId)
    setItemsLoading(true)
    try {
      const { data } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', billId)
      setExpandedItems(data || [])
    } finally { setItemsLoading(false) }
  }

  const thisMonthTotal = history
    .filter((b: any) => {
      const d = new Date(b.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s: number, b: any) => s + (b.net_amount || 0), 0)

  const pendingTotal = history
    .filter((b: any) => b.payment_status === 'pending')
    .reduce((s: number, b: any) => s + (b.net_amount || 0), 0)

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Purchases (Month)', value: `₹${thisMonthTotal.toLocaleString('en-IN')}`, color: G.primary },
          { label: 'Total Pending Payment', value: `₹${pendingTotal.toLocaleString('en-IN')}`, color: '#f97316' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: G.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: c.color, fontFamily: 'DM Mono' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        {(['all', 'paid', 'pending'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: '8px', border: filter === f ? 'none' : '1px solid #e2e8f0', background: filter === f ? G.primary : 'white', color: filter === f ? 'white' : G.muted, fontSize: '12px', fontFamily: 'DM Sans', cursor: 'pointer', textTransform: 'capitalize', fontWeight: filter === f ? 600 : 400 }}>
            {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Pending'}
          </button>
        ))}
        <button onClick={onRefresh}
          style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: G.muted, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontFamily: 'DM Sans' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading purchases...</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No purchase records found</div>
      ) : (
        <div style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Purchase No', 'Date', 'Supplier', 'Invoice No', 'Items', 'Amount', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((b: any) => (
                <>
                  <tr key={b.id} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                    onClick={() => loadItems(b.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <td style={{ padding: '12px', fontFamily: 'DM Mono', fontSize: '12px', color: G.primary, fontWeight: 600 }}>{b.purchase_no}</td>
                    <td style={{ padding: '12px', color: G.muted, fontSize: '12px' }}>
                      {new Date(b.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: '12px', color: '#1a0a2e', fontWeight: 500 }}>
                      {b.suppliers?.business_name || b.suppliers?.name || '—'}
                    </td>
                    <td style={{ padding: '12px', color: G.muted }}>{b.supplier_invoice_no || '—'}</td>
                    <td style={{ padding: '12px', color: G.muted }}>{b.purchase_items?.length || 0}</td>
                    <td style={{ padding: '12px', fontWeight: 700, fontFamily: 'DM Mono', color: '#1a0a2e' }}>
                      ₹{(b.net_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                        background: b.payment_status === 'paid' ? '#f0fdf4' : b.payment_status === 'pending' ? '#fff7ed' : '#eff6ff',
                        color: b.payment_status === 'paid' ? G.primary : b.payment_status === 'pending' ? '#ea580c' : '#2563eb',
                      }}>
                        {b.payment_status === 'paid' ? 'Paid' : b.payment_status === 'pending' ? 'Pending' : 'Partial'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <ChevronDown size={14} color={G.muted}
                        style={{ transform: expandedId === b.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </td>
                  </tr>
                  {expandedId === b.id && (
                    <tr key={`${b.id}-exp`}>
                      <td colSpan={8} style={{ padding: '0 12px 12px', background: '#f8fffe' }}>
                        {itemsLoading ? (
                          <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>Loading items...</div>
                        ) : (
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginTop: '4px' }}>
                            <thead>
                              <tr>
                                {['Product', 'Design', 'Size', 'Colour', 'Batch', 'Qty', 'Cost', 'MRP', 'GST%', 'Amount'].map(h => (
                                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {expandedItems.map((item: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{item.product_name}</td>
                                  <td style={{ padding: '6px 8px', color: G.muted }}>{item.design_no || '—'}</td>
                                  <td style={{ padding: '6px 8px', color: G.muted }}>{item.size || '—'}</td>
                                  <td style={{ padding: '6px 8px', color: G.muted }}>{item.colour || '—'}</td>
                                  <td style={{ padding: '6px 8px', color: G.muted }}>{item.batch_no || '—'}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{item.qty}</td>
                                  <td style={{ padding: '6px 8px', fontFamily: 'DM Mono' }}>₹{item.unit_cost}</td>
                                  <td style={{ padding: '6px 8px', fontFamily: 'DM Mono' }}>{item.mrp ? `₹${item.mrp}` : '—'}</td>
                                  <td style={{ padding: '6px 8px' }}>{item.gst_rate}%</td>
                                  <td style={{ padding: '6px 8px', fontFamily: 'DM Mono', fontWeight: 600 }}>₹{(item.line_total || 0).toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PurchaseEntryPage() {
  const hook = usePurchaseEntry()
  const tableRef = useRef<HTMLDivElement>(null)

  const purchaseNo = 'PO-' +
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' + String(hook.counter).padStart(4, '0')

  return (
    <Layout>
      <div style={{ padding: '24px', background: '#f0fdf4', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', background: G.primary, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={18} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Purchase Entry</h1>
            <div style={{ fontSize: '12px', color: G.muted }}>Record inward stock from suppliers</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'white', border: `1px solid ${G.border}`, borderRadius: '12px', padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
          {[
            { key: 'new', label: 'New Purchase Entry' },
            { key: 'history', label: 'Purchase History' },
          ].map(t => (
            <button key={t.key} onClick={() => hook.setTab(t.key as any)}
              style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: hook.tab === t.key ? G.primary : 'transparent', color: hook.tab === t.key ? 'white' : G.muted, fontSize: '13px', fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: hook.tab === t.key ? 600 : 400, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: NEW PURCHASE ─────────────────────────────────────────── */}
        {hook.tab === 'new' && (
          <div style={{ display: 'grid', gridTemplateColumns: '65fr 35fr', gap: '16px', alignItems: 'start' }}>

            {/* LEFT PANEL */}
            <div>
              {/* Supplier */}
              <SupplierSection
                supplier={hook.supplier}
                setSupplier={hook.setSupplier}
                supplierQuery={hook.supplierQuery}
                setSupplierQuery={hook.setSupplierQuery}
                supplierResults={hook.supplierResults}
                showSupplierDropdown={hook.showSupplierDropdown}
                setShowSupplierDropdown={hook.setShowSupplierDropdown}
                showNewSupplierForm={hook.showNewSupplierForm}
                setShowNewSupplierForm={hook.setShowNewSupplierForm}
                newSupplier={hook.newSupplier}
                setNewSupplier={hook.setNewSupplier}
                saveNewSupplier={hook.saveNewSupplier}
              />

              {/* Supplier Bill Details */}
              <div style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Supplier Bill Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Supplier Invoice No</label>
                    <input value={hook.supplierInvoiceNo} onChange={e => hook.setSupplierInvoiceNo(e.target.value)}
                      placeholder="B/2598" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Invoice Date</label>
                    <input type="date" value={hook.supplierInvoiceDate} onChange={e => hook.setSupplierInvoiceDate(e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Mode</label>
                    <select value={hook.paymentMode} onChange={e => hook.setPaymentMode(e.target.value as any)}
                      style={inputStyle}>
                      <option value="credit">Credit</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Items
                </div>

                <div ref={tableRef} style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${G.border}` }}>
                        {['#', 'Product', 'Design', 'PCode', 'Size', 'Colour', 'MRP', 'Qty', 'Batch', 'Cost', 'GST%', 'Amount', ''].map(h => (
                          <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hook.items.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', color: '#94a3b8', fontSize: '11px', width: '24px' }}>{idx + 1}</td>

                          {/* Product */}
                          <td style={{ padding: '4px 6px' }}>
                            <ProductCell
                              item={item}
                              onSelect={p => hook.updateItem(item.id, 'product', p)}
                              onNameChange={name => hook.updateItem(item.id, 'productName', name)}
                            />
                          </td>

                          {/* Design */}
                          <td style={{ padding: '4px 6px' }}>
                            <input value={item.design_no} onChange={e => hook.updateItem(item.id, 'design_no', e.target.value)}
                              placeholder="D001" style={{ ...inputStyle, width: '70px' }} />
                          </td>

                          {/* PCode */}
                          <td style={{ padding: '4px 6px' }}>
                            <input value={item.pcode} onChange={e => hook.updateItem(item.id, 'pcode', e.target.value)}
                              placeholder="PC01" style={{ ...inputStyle, width: '70px' }} />
                          </td>

                          {/* Size */}
                          <td style={{ padding: '4px 6px' }}>
                            <select value={item.size} onChange={e => hook.updateItem(item.id, 'size', e.target.value)}
                              style={{ ...inputStyle, width: '70px' }}>
                              <option value="">—</option>
                              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>

                          {/* Colour */}
                          <td style={{ padding: '4px 6px' }}>
                            <input value={item.colour} onChange={e => hook.updateItem(item.id, 'colour', e.target.value)}
                              placeholder="Blue" style={{ ...inputStyle, width: '70px' }} />
                          </td>

                          {/* MRP */}
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" value={item.mrp === '' ? '' : item.mrp}
                              onChange={e => hook.updateItem(item.id, 'mrp', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="0" style={{ ...inputStyle, width: '70px' }} />
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" value={item.qty === '' ? '' : item.qty}
                              onChange={e => hook.updateItem(item.id, 'qty', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                              placeholder="0" min="0"
                              style={{ ...inputStyle, width: '60px', fontSize: '14px', fontWeight: 700, color: G.primary }} />
                          </td>

                          {/* Batch */}
                          <td style={{ padding: '4px 6px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input value={item.batch_no} onChange={e => hook.updateItem(item.id, 'batch_no', e.target.value)}
                                placeholder="Batch" style={{ ...inputStyle, width: '60px' }} />
                              <button onClick={() => hook.generateBatch(item.id)} title="Auto generate"
                                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 5px', cursor: 'pointer', color: G.muted, fontSize: '9px', whiteSpace: 'nowrap' }}>
                                Auto
                              </button>
                            </div>
                          </td>

                          {/* Cost */}
                          <td style={{ padding: '4px 6px' }}>
                            <input type="number" value={item.unit_cost === '' ? '' : item.unit_cost}
                              onChange={e => hook.updateItem(item.id, 'unit_cost', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="0" min="0"
                              style={{ ...inputStyle, width: '80px' }} />
                          </td>

                          {/* GST% */}
                          <td style={{ padding: '4px 6px' }}>
                            <select value={item.gst_rate} onChange={e => hook.updateItem(item.id, 'gst_rate', parseFloat(e.target.value))}
                              style={{ ...inputStyle, width: '60px' }}>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '4px 6px', fontFamily: 'DM Mono', fontWeight: 600, color: '#1a0a2e', whiteSpace: 'nowrap' }}>
                            ₹{item.line_total.toLocaleString('en-IN')}
                          </td>

                          {/* Remove */}
                          <td style={{ padding: '4px 6px' }}>
                            <button onClick={() => hook.removeItem(item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={hook.addItem}
                  style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: G.hover, border: `1px dashed ${G.border}`, borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: G.primary, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
                  <Plus size={15} /> Add Item
                </button>
              </div>
            </div>

            {/* RIGHT PANEL — Bill Summary */}
            <div style={{ position: 'sticky', top: '24px' }}>
              <div style={{ background: 'white', border: `1px solid ${G.border}`, borderRadius: '14px', padding: '20px' }}>

                {/* Purchase No */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${G.border}` }}>
                  <div style={{ fontSize: '11px', color: G.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Purchase No</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '13px', fontWeight: 700, color: G.primary }}>{purchaseNo}</div>
                </div>

                {/* Summary numbers */}
                {[
                  { label: 'Total Items', value: `${hook.totalUnits} units`, mono: false },
                  { label: 'Subtotal', value: `₹${hook.subtotal.toLocaleString('en-IN')}`, mono: true },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: G.muted }}>{r.label}</span>
                    <span style={{ fontFamily: r.mono ? 'DM Mono' : 'inherit', fontWeight: r.mono ? 600 : 400, color: '#1a0a2e' }}>{r.value}</span>
                  </div>
                ))}

                {/* Discount */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: G.muted }}>Discount</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['amount', 'percent'] as const).map(m => (
                        <button key={m} onClick={() => hook.setDiscountMode(m)}
                          style={{ padding: '3px 8px', borderRadius: '6px', border: 'none', background: hook.discountMode === m ? G.primary : '#e2e8f0', color: hook.discountMode === m ? 'white' : G.muted, fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                          {m === 'amount' ? '₹' : '%'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number" min="0"
                    value={hook.discountMode === 'amount' ? hook.discountAmt : hook.discountPct}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      hook.discountMode === 'amount' ? hook.setDiscountAmt(v) : hook.setDiscountPct(v)
                    }}
                    style={{ ...inputStyle, textAlign: 'right' }}
                    placeholder="0"
                  />
                  {hook.effectiveDiscount > 0 && (
                    <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'right', marginTop: '4px' }}>
                      −₹{hook.effectiveDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* Freight */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: G.muted, whiteSpace: 'nowrap' }}>Freight / Transport</span>
                  <input type="number" min="0" value={hook.freightAmt || ''}
                    onChange={e => hook.setFreightAmt(parseFloat(e.target.value) || 0)}
                    placeholder="0" style={{ ...inputStyle, width: '100px', textAlign: 'right' }} />
                </div>

                {/* GST Type */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: G.muted, marginBottom: '8px' }}>GST Type</div>
                  {[
                    { value: 'gst', label: 'CGST + SGST (Intra-state)' },
                    { value: 'igst', label: 'IGST (Inter-state)' },
                  ].map(o => (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      <input type="radio" name="gstType" value={o.value} checked={hook.gstType === o.value}
                        onChange={() => hook.setGstType(o.value as any)} style={{ accentColor: G.primary }} />
                      {o.label}
                    </label>
                  ))}
                  <div style={{ marginTop: '8px', fontSize: '12px', color: G.muted }}>
                    Total GST: <span style={{ color: '#1a0a2e', fontFamily: 'DM Mono', fontWeight: 600 }}>₹{hook.totalGST.toFixed(2)}</span>
                  </div>
                  {hook.gstType === 'gst' && (
                    <>
                      <div style={{ fontSize: '11px', color: G.muted, marginTop: '4px' }}>
                        CGST: ₹{hook.cgst.toFixed(2)} &nbsp;|&nbsp; SGST: ₹{hook.sgst.toFixed(2)}
                      </div>
                    </>
                  )}
                  {hook.gstType === 'igst' && (
                    <div style={{ fontSize: '11px', color: G.muted, marginTop: '4px' }}>IGST: ₹{hook.igst.toFixed(2)}</div>
                  )}
                </div>

                {/* Round off */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: G.muted }}>Round Off</span>
                  <span style={{ fontFamily: 'DM Mono', color: G.muted }}>{hook.roundOff >= 0 ? '+' : ''}₹{hook.roundOff.toFixed(2)}</span>
                </div>

                {/* Net */}
                <div style={{ background: G.hover, borderRadius: '10px', padding: '14px', marginBottom: '16px', border: `1px solid ${G.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: G.text }}>NET PAYABLE</span>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: G.primary, fontFamily: 'DM Mono' }}>
                      ₹{hook.netAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Payment Status */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: G.muted, marginBottom: '6px' }}>Payment Status</div>
                  {[
                    { value: 'paid', label: 'Paid now' },
                    { value: 'pending', label: 'Credit (pay later)' },
                  ].map(o => (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input type="radio" name="payStatus" value={o.value} checked={hook.paymentStatus === o.value}
                        onChange={() => hook.setPaymentStatus(o.value as any)} style={{ accentColor: G.primary }} />
                      {o.label}
                    </label>
                  ))}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={hook.notes} onChange={e => hook.setNotes(e.target.value)}
                    rows={2} placeholder="Optional notes about this purchase..."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                {/* Save button */}
                <button
                  onClick={hook.savePurchase}
                  disabled={hook.loading}
                  style={{ width: '100%', padding: '13px', background: hook.loading ? '#86efac' : G.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: hook.loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', transition: 'background 0.15s' }}
                >
                  {hook.loading ? 'Saving...' : 'Save Purchase Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PURCHASE HISTORY ─────────────────────────────────── */}
        {hook.tab === 'history' && (
          <PurchaseHistory
            history={hook.history}
            loading={hook.historyLoading}
            filter={hook.historyFilter}
            setFilter={hook.setHistoryFilter}
            onRefresh={hook.fetchHistory}
          />
        )}
      </div>

      {/* Success modal */}
      {hook.showSuccessModal && hook.purchaseComplete && (
        <SuccessModal
          purchaseComplete={hook.purchaseComplete}
          onClose={() => hook.setShowSuccessModal(false)}
          onNewPurchase={() => { hook.setShowSuccessModal(false); hook.setTab('new') }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  )
}
