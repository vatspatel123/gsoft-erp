import { useState, useEffect } from 'react'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import { printPurchaseReturn } from '../utils/printBill'
import {
  RotateCcw, Search, Plus, Trash2, Printer,
  Building2, MessageCircle, ArrowLeft, PackageCheck, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

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
          .select('*, purchase_return_items(*)')
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

  const searchProducts = async (q: string) => {
    if (!q.trim()) { setProductResults([]); return }
    setProductLoading(true)
    try {
      if (navigator.onLine) {
        const { data } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${q}%,barcode.ilike.%${q}%,sku.ilike.%${q}%,design_no.ilike.%${q}%`)
          .eq('is_active', true)
          .limit(8)
        setProductResults(data || [])
      } else {
        const raw = localStorage.getItem('gsoft_products_cache')
        const all = raw ? JSON.parse(raw).data || [] : []
        const filtered = all.filter((p: any) =>
          p.name?.toLowerCase().includes(q.toLowerCase()) || p.barcode?.includes(q) || p.sku?.includes(q)
        ).slice(0, 8)
        setProductResults(filtered)
      }
    } catch {
      setProductResults([])
    } finally {
      setProductLoading(false)
    }
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
    setProductSearch('')
    setProductResults([])
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
        totalAmount: totalReturnAmount,
        reason: returnReason,
        items: returnItems.map(i => ({
          productName: i.product.name,
          size: i.product.size,
          colour: i.product.colour,
          qty: i.qty,
          unitCost: i.unitCost,
          lineTotal: i.lineTotal
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

  const sendSupplierWhatsApp = (ret: any) => {
    if (!ret.supplierPhone) {
      toast.error('Supplier phone number not available')
      return
    }
    const cleanPhone = ret.supplierPhone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const dateStr = new Date(ret.createdAt).toLocaleDateString('en-IN')

    const msg =
      `*📦 PURCHASE RETURN / DEBIT NOTE*%0A%0A` +
      `Vendor: *${ret.supplierName}*%0A` +
      `• *Debit Note No:* ${ret.returnNo}%0A` +
      `• *Date:* ${dateStr}%0A` +
      `• *Total Debit Amount:* ₹${Number(ret.totalAmount).toFixed(2)}%0A` +
      (ret.reason ? `• *Reason:* ${ret.reason}%0A` : '') +
      `%0A_Please adjust this debit note amount in our next statement._%0A` +
      `Thank you!`

    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank')
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
              onClick={() => setActiveTab('new')}
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
                    placeholder="Search by barcode, SKU, or product name..."
                    value={productSearch}
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
                              Stock: {p.stock_qty} · {p.size ? `Size: ${p.size} · ` : ''}{p.barcode || p.sku}
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
                  onClick={handleCompleteReturn}
                  disabled={saving || returnItems.length === 0 || !selectedSupplier}
                  style={{
                    width: '100%', background: saving || returnItems.length === 0 || !selectedSupplier ? '#cbd5e1' : '#dc2626',
                    color: 'white', border: 'none', borderRadius: '10px', padding: '12px',
                    fontSize: '14px', fontWeight: 700, cursor: saving || returnItems.length === 0 || !selectedSupplier ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                  {saving ? 'Processing...' : 'Confirm Return & Deduct Stock'}
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
                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(ret => (
                    <tr key={ret.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#dc2626' }}>
                        {ret.return_no}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {new Date(ret.created_at).toLocaleDateString('en-IN')}
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
                                lineTotal: i.line_total
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
