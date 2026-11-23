import { useState, useEffect, useRef } from 'react'
import { getCachedProducts, refreshProductsInCache } from '../utils/offlineCache'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import { printPurchaseReturn } from '../utils/printBill'
import {
  RotateCcw, Search, Plus, Trash2, Printer, Pencil,
  Building2, MessageCircle, ArrowLeft, PackageCheck, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { sendWhatsApp } from '../utils/whatsapp'
import { fmtDate } from '../utils/date'

interface ReturnItem {
  product: any
  qty: number
  unitCost: number
  lineTotal: number
}

const RETURN_REASONS = [
  'Damaged / Defective piece',
  'Wrong size / colour delivered',
  'Slow moving / Overstock return',
  'Quality issue / Fabric defect',
  'Pricing discrepancy / Excess billing'
]

export function PurchaseReturnPage() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<any[]>([])

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [productLoading, setProductLoading] = useState(false)

  // Return cart
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Completed modal
  const [completedReturn, setCompletedReturn] = useState<any>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // History list
  const [history, setHistory] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)   // the saved return being edited, or null for a new one
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        if (navigator.onLine) {
          const { data } = await supabase.from('suppliers').select('*').order('name')
          if (data) setSuppliers(data)
        }
      } catch (e) {}
    }
    fetchSuppliers()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') fetchHistory()
  }, [activeTab])

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('purchase_returns')
          .select('*, purchase_return_items(*, products(gst_rate, hsn_code))')
          .order('created_at', { ascending: false })

        if (!error && data) setHistory(data)
      } else {
        const local = localStorage.getItem('gsoft_purchase_returns_cache')
        if (local) setHistory(JSON.parse(local))
      }
    } catch (e) {
      console.warn('History fetch error:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Every search gets a number; only the newest one may show its results. A scanner types the
  // whole barcode in a few milliseconds, and an early search ("2", "24"…) used to come back last
  // and cover the right result.
  const searchSeq = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const findProducts = async (raw: string): Promise<any[]> => {
    const q = raw.trim().replace(/[",()%*]/g, '')
    if (!q) return []
    const ql = q.toLowerCase()
    const exactFields = ['barcode', 'sku', 'design_no', 'batch_no', 'pcode']
    let rows: any[] = []
    if (navigator.onLine) {
      try {
        const [exact, like] = await Promise.all([
          supabase.from('products').select('*').eq('is_active', true)
            .or(exactFields.map(f => `${f}.eq.${q}`).join(',')).limit(100),
          supabase.from('products').select('*').eq('is_active', true)
            .or(`name.ilike.%${q}%,barcode.ilike.%${q}%,sku.ilike.%${q}%,design_no.ilike.%${q}%`).limit(60),
        ])
        if (exact.error && like.error) throw exact.error
        // pcode/batch_no may not exist on older databases: fall back to the basic exact fields.
        let exactRows = exact.data || []
        if (exact.error) {
          const { data } = await supabase.from('products').select('*').eq('is_active', true)
            .or(['barcode', 'sku', 'design_no'].map(f => `${f}.eq.${q}`).join(',')).limit(100)
          exactRows = data || []
        }
        const seen = new Set<string>()
        rows = [...exactRows, ...(like.data || [])].filter(p => !seen.has(p.id) && seen.add(p.id))
      } catch { rows = [] }
    }
    if (!rows.length) {
      // No internet (or the server failed): use this PC's copy of the products.
      const all = (getCachedProducts() || []) as any[]
      rows = all.filter(p => p.is_active !== false && (
        exactFields.some(f => String(p[f] ?? '').toLowerCase() === ql) ||
        [p.name, p.barcode, p.sku, p.design_no].some(v => String(v ?? '').toLowerCase().includes(ql))))
    }
    // Best match first: exact barcode/SKU, then exact design no, then starts with, then contains.
    // Within each, pieces in stock before stock 0, then by design and size.
    const rank = (p: any) => {
      const eq = (v: any) => String(v ?? '').toLowerCase() === ql
      const sw = (v: any) => String(v ?? '').toLowerCase().startsWith(ql)
      if (eq(p.barcode) || eq(p.sku) || eq(p.batch_no) || eq(p.pcode)) return 0
      if (eq(p.design_no)) return 1
      if (sw(p.barcode) || sw(p.design_no) || sw(p.sku)) return 2
      return 3
    }
    return rows
      .map(p => ({ p, r: rank(p) }))
      .sort((a, b) => a.r - b.r
        || (Number(b.p.stock_qty) > 0 ? 1 : 0) - (Number(a.p.stock_qty) > 0 ? 1 : 0)
        || String(a.p.design_no ?? '').localeCompare(String(b.p.design_no ?? ''))
        || String(a.p.size ?? '').localeCompare(String(b.p.size ?? ''), undefined, { numeric: true }))
      .map(x => x.p)
      .slice(0, 50)
  }

  const searchProducts = (q: string, delay = 250) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const seq = ++searchSeq.current
    if (!q.trim()) { setProductResults([]); setProductLoading(false); return }
    searchTimer.current = setTimeout(async () => {
      setProductLoading(true)
      const rows = await findProducts(q)
      if (seq !== searchSeq.current) return   // a newer search started: drop this old result
      setProductResults(rows)
      setProductLoading(false)
    }, delay)
  }

  // Enter (a scanner sends it at the end): a single exact barcode match goes straight onto the return.
  const handleSearchEnter = async () => {
    const q = productSearch.trim()
    if (!q) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const seq = ++searchSeq.current
    setProductLoading(true)
    const rows = await findProducts(q)
    if (seq !== searchSeq.current) return
    setProductLoading(false)
    const ql = q.toLowerCase()
    const exact = rows.filter(p => ['barcode', 'sku', 'batch_no', 'pcode'].some(f => String(p[f] ?? '').toLowerCase() === ql))
    if (exact.length === 1) { addProductToReturn(exact[0]); return }
    setProductResults(rows)
    if (!rows.length) toast.error('No product found for ' + q)
  }

  const addProductToReturn = (product: any) => {
    const cost = product.cost_price || product.unit_price * 0.7 || 0
    setReturnItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        const newQty = existing.qty + 1
        return prev.map(i => i.product.id === product.id ? { ...i, qty: newQty, lineTotal: newQty * i.unitCost } : i)
      }
      return [...prev, { product, qty: 1, unitCost: cost, lineTotal: cost }]
    })
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchSeq.current++   // any search still running must not reopen the list
    setProductSearch('')
    setProductResults([])
    setProductLoading(false)
  }

  const updateItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setReturnItems(prev => prev.filter(i => i.product.id !== productId))
      return
    }
    setReturnItems(prev => prev.map(i => i.product.id === productId ? { ...i, qty, lineTotal: qty * i.unitCost } : i))
  }

  const updateItemCost = (productId: string, unitCost: number) => {
    setReturnItems(prev => prev.map(i => i.product.id === productId ? { ...i, unitCost, lineTotal: i.qty * unitCost } : i))
  }

  const totalReturnAmount = returnItems.reduce((sum, i) => sum + i.lineTotal, 0)
  const totalReturnQty = returnItems.reduce((sum, i) => sum + i.qty, 0)

  const handleCompleteReturn = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier')
      return
    }
    if (returnItems.length === 0) {
      toast.error('Add at least one product to return')
      return
    }

    setSaving(true)
    try {
      const year = new Date().getFullYear()
      const rand = Math.floor(1000 + Math.random() * 9000)
      const returnNo = `PR-${year}-${rand}`

      const returnRecord = {
        id: crypto.randomUUID(),
        return_no: returnNo,
        supplier_id: selectedSupplier.id,
        supplier_name: selectedSupplier.name,
        supplier_phone: selectedSupplier.phone,
        total_amount: totalReturnAmount,
        status: 'completed',
        reason: returnReason,
        notes: notes || null,
        created_at: new Date().toISOString()
      }

      // 1. Insert into purchase_returns
      if (navigator.onLine) {
        try {
          await supabase.from('purchase_returns').insert(returnRecord)
          await supabase.from('purchase_return_items').insert(
            returnItems.map(i => ({
              id: crypto.randomUUID(),
              purchase_return_id: returnRecord.id,
              product_id: i.product.id,
              product_name: i.product.name,
              sku: i.product.sku,
              barcode: i.product.barcode,
              size: i.product.size,
              colour: i.product.colour,
              qty: i.qty,
              unit_cost: i.unitCost,
              line_total: i.lineTotal
            }))
          )
        } catch (dbErr: any) {
          console.warn('DB purchase return insert notice (continuing with stock update):', dbErr)
        }
      }

      // 2. Deduct inventory stock for returned goods
      for (const item of returnItems) {
        try {
          if (navigator.onLine) {
            const { data: p } = await supabase.from('products').select('stock_qty').eq('id', item.product.id).single()
            if (p) {
              const newStock = Math.max(0, p.stock_qty - item.qty)
              await supabase.from('products').update({ stock_qty: newStock }).eq('id', item.product.id)
            }
          }
        } catch (e) {
          console.warn('Stock update notice:', e)
        }
      }

      // 3. Update local cache
      try {
        const localStr = localStorage.getItem('gsoft_purchase_returns_cache')
        const currentList = localStr ? JSON.parse(localStr) : []
        localStorage.setItem('gsoft_purchase_returns_cache', JSON.stringify([returnRecord, ...currentList]))
      } catch {}

      const completeData = {
        returnNo,
        supplierName: selectedSupplier.name,
        supplierPhone: selectedSupplier.phone,
        supplierGstin: selectedSupplier.gstin,
        totalAmount: totalReturnAmount,
        reason: returnReason,
        items: returnItems.map(i => ({
          productName: i.product.name,
          size: i.product.size,
          colour: i.product.colour,
          qty: i.qty,
          unitCost: i.unitCost,
          lineTotal: i.lineTotal,
          gstRate: i.product.gst_rate,
          hsn: i.product.hsn_code,
        })),
        createdAt: new Date().toISOString()
      }

      setCompletedReturn(completeData)
      setShowSuccessModal(true)
      toast.success(`Debit Note ${returnNo} created! Stock deducted.`)

      // Reset form
      setReturnItems([])
      setNotes('')
    } catch (err: any) {
      toast.error('Failed to complete return: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Edit a saved return ────────────────────────────────────────────────
  // Opens the same form filled with the saved return. Saving changes the stock only by the
  // difference: a piece taken off the return goes back into stock, an extra piece comes out.
  const startEdit = async (ret: any) => {
    if (!navigator.onLine) { toast.error('Editing a return needs the internet'); return }
    const rows: any[] = ret.purchase_return_items || []
    const ids = [...new Set(rows.map(r => r.product_id).filter(Boolean))]
    const { data: prods, error } = ids.length
      ? await supabase.from('products').select('*').in('id', ids)
      : { data: [] as any[], error: null }
    if (error) { toast.error('Could not load the products of this return'); return }
    const byId = new Map((prods || []).map((p: any) => [p.id, p]))
    setReturnItems(rows.map(r => ({
      // A product deleted since the return keeps its line, but its stock can't change.
      product: byId.get(r.product_id) || {
        id: `gone-${r.id}`, _missing: true, name: r.product_name, sku: r.sku, barcode: r.barcode,
        size: r.size, colour: r.colour, stock_qty: '—',
      },
      qty: Number(r.qty) || 0,
      unitCost: Number(r.unit_cost) || 0,
      lineTotal: Number(r.line_total) || 0,
    })))
    setSelectedSupplier(suppliers.find(s => s.id === ret.supplier_id)
      || { id: ret.supplier_id, name: ret.supplier_name, phone: ret.supplier_phone })
    setReturnReason(ret.reason || RETURN_REASONS[0])
    setNotes(ret.notes || '')
    setProductSearch(''); setProductResults([])
    setEditing(ret)
    setActiveTab('new')
  }

  const cancelEdit = () => {
    setEditing(null)
    setReturnItems([]); setNotes(''); setReturnReason(RETURN_REASONS[0]); setSelectedSupplier(null)
    setActiveTab('history')
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!navigator.onLine) { toast.error('Saving the edit needs the internet'); return }
    if (!selectedSupplier) { toast.error('Please select a supplier'); return }
    if (returnItems.length === 0) { toast.error('A return needs at least one product'); return }
    setSaving(true)
    try {
      const oldRows: any[] = editing.purchase_return_items || []
      const oldQty = new Map<string, number>()
      for (const r of oldRows) if (r.product_id) oldQty.set(r.product_id, (oldQty.get(r.product_id) || 0) + Number(r.qty || 0))
      const newQty = new Map<string, number>()
      for (const i of returnItems) if (!i.product._missing) newQty.set(i.product.id, (newQty.get(i.product.id) || 0) + i.qty)

      // 1. The return itself. New lines go in before the old ones are removed, so a failure never loses lines.
      const { error: hErr } = await supabase.from('purchase_returns').update({
        supplier_id: selectedSupplier.id, supplier_name: selectedSupplier.name, supplier_phone: selectedSupplier.phone,
        total_amount: totalReturnAmount, reason: returnReason, notes: notes || null,
      }).eq('id', editing.id)
      if (hErr) throw hErr
      const { error: iErr } = await supabase.from('purchase_return_items').insert(returnItems.map(i => ({
        id: crypto.randomUUID(),
        purchase_return_id: editing.id,
        product_id: i.product._missing ? null : i.product.id,
        product_name: i.product.name, sku: i.product.sku, barcode: i.product.barcode,
        size: i.product.size, colour: i.product.colour,
        qty: i.qty, unit_cost: i.unitCost, line_total: i.lineTotal,
      })))
      if (iErr) throw iErr
      if (oldRows.length) {
        const { error: dErr } = await supabase.from('purchase_return_items').delete().in('id', oldRows.map(r => r.id))
        if (dErr) throw dErr
      }

      // 2. Stock: only the difference.
      const failed: string[] = []
      const changed: string[] = []
      for (const id of new Set([...oldQty.keys(), ...newQty.keys()])) {
        const delta = (newQty.get(id) || 0) - (oldQty.get(id) || 0)   // more returned = less stock
        if (!delta) continue
        try {
          const { data: p, error } = await supabase.from('products').select('stock_qty, name').eq('id', id).single()
          if (error || !p) throw error
          const stock = Number(p.stock_qty) || 0
          const { error: uErr } = await supabase.from('products')
            .update({ stock_qty: delta > 0 ? Math.max(0, stock - delta) : stock - delta }).eq('id', id)
          if (uErr) throw uErr
          changed.push(id)
        } catch {
          failed.push(returnItems.find(i => i.product.id === id)?.product.name || oldRows.find(r => r.product_id === id)?.product_name || id)
        }
      }
      if (changed.length) refreshProductsInCache(changed).catch(() => {})

      if (failed.length) toast.error(`Return saved, but stock was not changed for: ${failed.join(', ')}. Check these in Inventory.`, { duration: 8000 })
      else toast.success(`${editing.return_no} updated`)
      cancelEdit()
      fetchHistory()
    } catch (err: any) {
      toast.error('Could not save the changes: ' + (err?.message || 'unknown error') + '. Nothing in stock was changed.')
    } finally {
      setSaving(false)
    }
  }

  const sendSupplierWhatsApp = (ret: any) => {
    if (!ret.supplierPhone) {
      toast.error('Supplier phone number not available')
      return
    }
    const cleanPhone = ret.supplierPhone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const dateStr = fmtDate(new Date(ret.createdAt))

    const msg =
      `*📦 PURCHASE RETURN / DEBIT NOTE*%0A%0A` +
      `Vendor: *${ret.supplierName}*%0A` +
      `• *Debit Note No:* ${ret.returnNo}%0A` +
      `• *Date:* ${dateStr}%0A` +
      `• *Total Debit Amount:* ₹${Number(ret.totalAmount).toFixed(2)}%0A` +
      (ret.reason ? `• *Reason:* ${ret.reason}%0A` : '') +
      `%0A_Please adjust this debit note amount in our next statement._%0A` +
      `Thank you!`

    sendWhatsApp(fullPhone, msg, { encoded: true })
  }

  return (
    <Layout>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw color="#dc2626" /> Purchase Returns & Debit Notes
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
              Return stock to suppliers, automatically adjust inventory, and generate Debit Note vouchers.
            </p>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
            <button
              onClick={() => {
                if (editing) { setEditing(null); setReturnItems([]); setNotes(''); setReturnReason(RETURN_REASONS[0]); setSelectedSupplier(null) }
                setActiveTab('new')
              }}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: activeTab === 'new' ? 'white' : 'transparent',
                color: activeTab === 'new' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'new' ? 700 : 500, fontSize: '13px', cursor: 'pointer',
                boxShadow: activeTab === 'new' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>
              + New Return
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: activeTab === 'history' ? 'white' : 'transparent',
                color: activeTab === 'history' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'history' ? 700 : 500, fontSize: '13px', cursor: 'pointer',
                boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>
              History & Debit Notes ({history.length})
            </button>
          </div>
        </div>

        {activeTab === 'new' && editing && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f3e8ff', border: '1px solid #c084fc', borderRadius: '12px', padding: '10px 16px', marginBottom: '16px', color: '#6b21a8', fontWeight: 700, fontSize: '14px' }}>
            <span>Editing {editing.return_no} · stock changes only by the difference when you save</span>
            <button onClick={cancelEdit} disabled={saving}
              style={{ background: 'white', border: '1px solid #c084fc', color: '#6b21a8', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
        {activeTab === 'new' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
            {/* Left Column: Supplier & Items */}
            <div>
              {/* 1. Supplier Selector */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={14} /> 1. Select Supplier
                </div>

                {selectedSupplier ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px' }}>{selectedSupplier.name}</div>
                      <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                        📱 {selectedSupplier.phone || 'No phone'} {selectedSupplier.gstin ? `· GSTIN: ${selectedSupplier.gstin}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSupplier(null)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search supplier name or phone..."
                      value={supplierSearch}
                      onChange={e => {
                        setSupplierSearch(e.target.value)
                        const q = e.target.value.toLowerCase()
                        setSupplierResults(suppliers.filter(s => s.name?.toLowerCase().includes(q) || s.phone?.includes(q)))
                      }}
                      style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {supplierSearch && supplierResults.length > 0 && (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto', background: 'white' }}>
                        {supplierResults.map(s => (
                          <div
                            key={s.id}
                            onClick={() => { setSelectedSupplier(s); setSupplierSearch(''); setSupplierResults([]); }}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ fontWeight: 600 }}>{s.name}</span>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>{s.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {supplierSearch && supplierResults.length === 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            const newSup = { id: crypto.randomUUID(), name: supplierSearch, phone: '' }
                            setSelectedSupplier(newSup)
                            setSupplierSearch('')
                          }}
                          style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          + Use "{supplierSearch}" as Supplier
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Product Search & Return Cart */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  2. Select Products to Return
                </div>

                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Scan barcode, or search by design no / name..."
                    value={productSearch}
                    data-enter="own"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchEnter() } }}
                    onChange={e => {
                      setProductSearch(e.target.value)
                      searchProducts(e.target.value)
                    }}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />

                  {productSearch && productResults.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '220px', overflowY: 'auto' }}>
                      {productResults.map(p => (
                        <div
                          key={p.id}
                          onClick={() => addProductToReturn(p)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Stock: {p.stock_qty} · {p.size ? `Size: ${p.size} · ` : ''}{p.colour ? `Colour: ${p.colour} · ` : ''}{p.barcode || p.sku}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                              ₹{p.cost_price || p.unit_price}
                            </div>
                            <div style={{ fontSize: '10px', color: '#16a34a' }}>+ Add to return</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Return Items Table */}
                {returnItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    Scan or search products above to add them to this return.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '11px', textAlign: 'left' }}>
                        <th style={{ padding: '8px 4px' }}>Product</th>
                        <th style={{ padding: '8px 4px', width: '90px' }}>Return Qty</th>
                        <th style={{ padding: '8px 4px', width: '110px' }}>Unit Cost</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right', width: '100px' }}>Total</th>
                        <th style={{ width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map(item => (
                        <tr key={item.product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 4px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.product.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.product.size && <span>Size: {item.product.size} · </span>}
                              Current Stock: {item.product.stock_qty}
                            </div>
                          </td>
                          <td style={{ padding: '10px 4px' }}>
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={e => updateItemQty(item.product.id, parseInt(e.target.value) || 1)}
                              style={{ width: '70px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: '10px 4px' }}>
                            <input
                              type="number"
                              min={0}
                              value={item.unitCost}
                              onChange={e => updateItemCost(item.product.id, parseFloat(e.target.value) || 0)}
                              style={{ width: '90px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontFamily: 'DM Mono, monospace' }}>
                            ₹{item.lineTotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => updateItemQty(item.product.id, 0)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right Column: Reason & Submit */}
            <div>
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', position: 'sticky', top: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#1e1b4b' }}>
                  Return Summary
                </h3>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Reason for Return
                  </label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', background: 'white', outline: 'none' }}>
                    {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Add batch/memo details..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Total box */}
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                    <span>Total Quantity:</span>
                    <strong>{totalReturnQty} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: '#dc2626', borderTop: '1px solid #fca5a5', paddingTop: '8px', marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>
                    <span>Debit Total:</span>
                    <span>₹{totalReturnAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={editing ? handleSaveEdit : handleCompleteReturn}
                  disabled={saving || returnItems.length === 0 || !selectedSupplier}
                  style={{
                    width: '100%', background: saving || returnItems.length === 0 || !selectedSupplier ? '#cbd5e1' : '#dc2626',
                    color: 'white', border: 'none', borderRadius: '10px', padding: '12px',
                    fontSize: '14px', fontWeight: 700, cursor: saving || returnItems.length === 0 || !selectedSupplier ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                  {saving ? 'Processing...' : editing ? 'Save Changes' : 'Confirm Return & Deduct Stock'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading return history...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No purchase returns recorded yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Debit Note No</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Supplier</th>
                    <th style={{ padding: '12px 16px' }}>Reason</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '200px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(ret => (
                    <tr key={ret.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#dc2626' }}>
                        {ret.return_no}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {fmtDate(new Date(ret.created_at))}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {ret.supplier_name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                        {ret.reason || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'DM Mono, monospace' }}>
                        ₹{Number(ret.total_amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button title="Edit this return" onClick={() => startEdit(ret)}
                            style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => printPurchaseReturn({
                              returnNo: ret.return_no,
                              supplierName: ret.supplier_name,
                              supplierPhone: ret.supplier_phone,
                              totalAmount: ret.total_amount,
                              reason: ret.reason,
                              items: (ret.purchase_return_items || []).map((i: any) => ({
                                productName: i.product_name,
                                size: i.size,
                                colour: i.colour,
                                qty: i.qty,
                                unitCost: i.unit_cost,
                                lineTotal: i.line_total,
                                gstRate: i.products?.gst_rate,
                                hsn: i.products?.hsn_code,
                              })),
                              createdAt: ret.created_at
                            })}
                            style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            <Printer size={13} />
                          </button>
                          {ret.supplier_phone && (
                            <button
                              onClick={() => sendSupplierWhatsApp({
                                returnNo: ret.return_no,
                                supplierName: ret.supplier_name,
                                supplierPhone: ret.supplier_phone,
                                totalAmount: ret.total_amount,
                                reason: ret.reason,
                                createdAt: ret.created_at
                              })}
                              style={{ background: '#16a34a', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              <MessageCircle size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && completedReturn && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>📦</div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e1b4b' }}>
                Purchase Return Complete!
              </h2>
              <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>
                Debit Note: {completedReturn.returnNo}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Stock deducted & Debit Note generated for {completedReturn.supplierName}.
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', margin: '16px 0', fontSize: '18px', fontWeight: 800, color: '#dc2626', fontFamily: 'DM Mono, monospace' }}>
                Total: ₹{Number(completedReturn.totalAmount).toFixed(2)}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => printPurchaseReturn(completedReturn)}
                    style={{ flex: 1, background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    🖨️ Print Debit Note
                  </button>
                  <button
                    onClick={() => sendSupplierWhatsApp(completedReturn)}
                    disabled={!completedReturn.supplierPhone}
                    style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: completedReturn.supplierPhone ? 1 : 0.4 }}>
                    💬 WhatsApp Slip
                  </button>
                </div>
                <button
                  onClick={() => { setShowSuccessModal(false); setCompletedReturn(null); }}
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#64748b' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
