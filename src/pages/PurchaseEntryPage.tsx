import { useSizes } from '../utils/productOrder'
import { useState, useEffect, useRef, Fragment } from 'react'
import { Layout } from '../components/shared/Layout'
import { usePurchaseEntry } from '../hooks/usePurchaseEntry'
import { PrintLabelsModal } from '../components/inventory/PrintLabelsModal'
import { PurchaseBillsList } from './PurchaseBillsPage'
import { supabase } from '../lib/supabase'
import {
  Search, X, Plus, Trash2, Copy,
  ShoppingBag, Printer, Tag
} from 'lucide-react'
import { printPurchaseA4 } from '../utils/printA4Purchase'

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

// Item-row boxes: tighter sides so the whole row fits the screen.
const cellInput: React.CSSProperties = { ...inputStyle, padding: '7px 6px' }

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px',
}

const GST_RATES = [0, 5, 12, 18, 28]

// ─── Product name cell ────────────────────────────────────────────────────────
// Suggests the shop's category names ("T-SHIRT") as plain text. It used to offer
// existing products, and picking one turned the row — and every row copied from
// it — into a restock of that old item, piling new stock and barcodes onto it.
function ProductCell({ item, onNameChange }: { item: any; onNameChange: (name: string) => void }) {
  return (
    <input
      list="purchase-product-names"
      value={item.productName}
      onChange={e => onNameChange(e.target.value)}
      placeholder="Product name..."
      style={{ ...cellInput, minWidth: '110px' }}
    />
  )
}

/** The names ProductCell suggests: the shop's categories. */
function ProductNameList() {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    supabase.from('categories').select('name').order('name').then(({ data }) => setNames((data || []).map(c => c.name)))
  }, [])
  return <datalist id="purchase-product-names">{names.map(n => <option key={n} value={n} />)}</datalist>
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
// Purchase lines in the shape the label printer takes (after a purchase, or new lines after an edit).
const toLabelProducts = (items: any[]) => items.map((item: any) => ({
  id: item.product?.id || item.id,
  name: item.product?.name || item.productName,
  design_no: item.design_no || item.product?.design_no || '',
  colour: item.colour || item.product?.colour || '',
  size: item.size || item.product?.size || '',
  pcode: item.pcode || item.product?.pcode || '',
  mrp: item.mrp || item.product?.mrp || '',
  unit_price: item.product?.unit_price || item.mrp || '',
  barcode: item.barcode || item.product?.barcode || item.product?.sku || '',
  batch_no: '',
  defaultCopies: typeof item.qty === 'number' ? item.qty : 1,
  // after an edit: tick only the lines whose quantity went up (or are new), with that many labels
  ...(item._more !== undefined ? { initialCopies: item._more, initialIncluded: item._more > 0 } : {}),
}))

function SuccessModal({
  purchaseComplete, onClose, onNewPurchase,
}: {
  purchaseComplete: any
  onClose: () => void
  onNewPurchase: () => void
}) {
  const [showLabels, setShowLabels] = useState(false)

  // The GST layout the shop's accountant already uses, on A4 — this used to be a
  // receipt-shaped page sent to the 80mm thermal printer despite the "(A4)" label.
  const printBill = () => {
    const { purchaseNo, bill, items, supplier } = purchaseComplete
    printPurchaseA4({
      kind: 'purchase',
      docNo: purchaseNo,
      date: bill?.supplier_invoice_date || new Date(),
      supplierName: supplier?.business_name || supplier?.name || '',
      supplierGstin: supplier?.gstin,
      origBillNo: bill?.supplier_invoice_no,
      origDate: bill?.supplier_invoice_date,
      items: items.map((it: any) => ({
        name: [it.product?.name || it.productName, it.design_no, it.colour, it.size]
          .filter(Boolean).join(' · '),
        hsn: it.hsn_code || it.product?.hsn_code || '',
        qty: Number(it.qty) || 0,
        rate: Number(it.unit_cost) || 0,
        gstPct: Number(it.gst_rate) || 0,
      })),
    })
  }

  // Build products array for label printing
  const labelProducts = toLabelProducts(purchaseComplete?.items || [])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)'
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', padding: '28px',
          width: '480px', maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '44px', marginBottom: '6px' }}>📦</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1a0a2e' }}>Purchase Saved & Stock Inwarded!</div>
            <div style={{ fontSize: '13px', color: G.primary, fontWeight: 700, marginTop: '4px', fontFamily: 'DM Mono' }}>
              {purchaseComplete?.purchaseNo}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Items are added to inventory and barcodes have been generated.
            </div>
          </div>

          <div style={{ background: G.hover, borderRadius: '12px', padding: '12px 14px', marginBottom: '18px', border: `1px solid ${G.border}` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: G.text, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Inwarded Stock Items
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {(purchaseComplete?.items || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#1a0a2e', fontWeight: 600 }}>
                      {item.product?.name || item.productName}
                    </span>
                    {item.size && <span style={{ color: G.muted }}> ({item.size})</span>}
                    {item.product?.barcode && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'DM Mono' }}>
                        Barcode: {item.product.barcode}
                      </div>
                    )}
                  </div>
                  <span style={{ color: G.primary, fontWeight: 700, fontFamily: 'DM Mono' }}>
                    +{item.qty} units
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setShowLabels(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px', background: '#9333ea', color: 'white',
                border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'DM Sans', fontWeight: 700, boxShadow: '0 4px 12px rgba(147,51,234,0.25)'
              }}>
              <Tag size={16} /> 🏷️ Print Barcode Labels Now
            </button>
            <button onClick={printBill}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', background: 'white', border: `1px solid ${G.border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500, color: G.text }}>
              <Printer size={15} /> Print Purchase Bill (A4)
            </button>
            <button onClick={onNewPurchase}
              style={{ width: '100%', padding: '10px', background: '#f0fdf4', color: G.primary, border: `1px solid ${G.border}`, borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
              + New Purchase Entry
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PurchaseEntryPage({ initialTab = 'new' }: { initialTab?: 'new' | 'bills' } = {}) {
  const allSizes = useSizes()
  const hook = usePurchaseEntry(initialTab)
  const [editLabels, setEditLabels] = useState<any[] | null>(null)   // new lines added in an edit
  const saveEdit = async () => {
    const added = await hook.saveEdit()
    if (added?.some(r => r._more > 0)) setEditLabels(toLabelProducts(added))
  }
  const tableRef = useRef<HTMLDivElement>(null)

  const purchaseNo = hook.editing ? hook.editing.no : 'PO-' +
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
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Purchase Entry &amp; Bills</h1>
            <div style={{ fontSize: '12px', color: G.muted }}>Record inward stock from suppliers, and print or edit any purchase bill</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'white', border: `1px solid ${G.border}`, borderRadius: '12px', padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
          {[
            { key: 'new', label: hook.editing ? `✏️ Editing ${hook.editing.no}` : 'New Purchase Entry' },
            { key: 'bills', label: 'Purchase Bills' },
          ].map(t => (
            <button key={t.key} onClick={() => hook.setTab(t.key as any)}
              style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: hook.tab === t.key ? G.primary : 'transparent', color: hook.tab === t.key ? 'white' : G.muted, fontSize: '13px', fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: hook.tab === t.key ? 600 : 400, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: NEW PURCHASE ─────────────────────────────────────────── */}
        {hook.tab === 'new' && (
          // Side by side when the screen has room; otherwise the totals drop below the
          // items, so the bill never needs scrolling sideways.
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>

            {/* LEFT PANEL */}
            <div style={{ flex: '999 1 900px', minWidth: 0 }}>
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
                      disabled={!!hook.editing} title={hook.editing ? 'Not changed by an edit' : undefined}
                      style={{ ...inputStyle, ...(hook.editing ? { background: '#f8fafc', color: G.muted } : {}) }}>
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
                  <ProductNameList />
                  <datalist id="purchase-sizes">{allSizes.map(sz => <option key={sz} value={sz} />)}</datalist>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${G.border}` }}>
                        {['#', 'Product', 'Design', 'PCode', 'Size', 'Colour', 'MRP', 'Wholesale', 'Online', 'Qty', 'Barcode', 'Cost', 'GST%', 'Amount', ''].map(h => (
                          <th key={h} style={{ padding: '8px 3px', textAlign: 'left', fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hook.items.map((item, idx) => {
                        // Rows copied from one another share a groupId, so they read as
                        // a single design in several colours.
                        const prevItem = hook.items[idx - 1]
                        const nextItem = hook.items[idx + 1]
                        const isFollowOn = !!item.groupId && prevItem?.groupId === item.groupId
                        const inGroup = !!item.groupId
                        // Last row of a set: offer to repeat the whole set in another size.
                        const isSetEnd = inGroup && nextItem?.groupId !== item.groupId
                        const setSize = inGroup ? hook.items.filter(i => i.groupId === item.groupId).length : 0
                        return (
                        <Fragment key={item.id}>
                        <tr style={{
                          borderBottom: isFollowOn ? '1px solid #f8fafc' : '1px solid #f1f5f9',
                          background: inGroup ? '#f7fdfa' : undefined
                        }}>
                          <td style={{ padding: '6px', color: '#94a3b8', fontSize: '11px', width: '24px' }}>
                            {isFollowOn ? <span style={{ color: '#cbd5e1' }}>↳</span> : idx + 1}
                          </td>

                          {/* Product */}
                          <td style={{ padding: '4px 3px' }}>
                            <ProductCell item={item} onNameChange={name => hook.updateItem(item.id, 'productName', name)} />
                          </td>

                          {/* Design — dimmed on follow-on colour rows of the same design */}
                          <td style={{ padding: '4px 3px' }}>
                            <input value={item.design_no} onChange={e => hook.updateItem(item.id, 'design_no', e.target.value)}
                              placeholder="D001" style={{ ...cellInput, width: '56px', opacity: isFollowOn ? 0.45 : 1 }} />
                          </td>

                          {/* PCode */}
                          <td style={{ padding: '4px 3px' }}>
                            <input value={item.pcode} onChange={e => hook.updateItem(item.id, 'pcode', e.target.value)}
                              placeholder="PC01" style={{ ...cellInput, width: '56px', opacity: isFollowOn ? 0.45 : 1 }} />
                          </td>

                          {/* Size */}
                          <td style={{ padding: '4px 3px' }}>
                            {/* Pick a standard size or type any other (9XL, 40-42…). */}
                            <input list="purchase-sizes" value={item.size} onChange={e => hook.updateItem(item.id, 'size', e.target.value)}
                              placeholder="Size" style={{ ...cellInput, width: '58px' }} />
                          </td>

                          {/* Colour */}
                          <td style={{ padding: '4px 3px' }}>
                            <input value={item.colour} onChange={e => hook.updateItem(item.id, 'colour', e.target.value)}
                              placeholder="Blue" style={{ ...cellInput, width: '60px' }} />
                          </td>

                          {/* MRP */}
                          <td style={{ padding: '4px 3px' }}>
                            <input type="number" value={item.mrp === '' ? '' : item.mrp}
                              onChange={e => hook.updateItem(item.id, 'mrp', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="0" style={{ ...cellInput, width: '62px' }} />
                          </td>

                          {/* Wholesale and website prices for the new product */}
                          {(['wholesale_price', 'online_price'] as const).map(k => (
                            <td key={k} style={{ padding: '4px 3px' }}>
                              <input type="number" value={item[k] === '' ? '' : item[k]}
                                onChange={e => hook.updateItem(item.id, k, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder={k === 'online_price' ? String(item.mrp || 0) : '0'}
                                title={k === 'online_price' ? 'Website price — blank uses the MRP' : 'Wholesale price'}
                                style={{ ...cellInput, width: '62px' }} />
                            </td>
                          ))}

                          {/* Qty */}
                          <td style={{ padding: '4px 3px' }}>
                            <input type="number" value={item.qty === '' ? '' : item.qty}
                              onChange={e => hook.updateItem(item.id, 'qty', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                              placeholder="qty" min="0"
                              style={{ ...cellInput, width: '48px', fontSize: '14px', fontWeight: 700, color: G.primary,
                                ...(hook.missingQty(item) ? { borderColor: '#ef4444', background: '#fef2f2' } : {}) }} />
                          </td>

                          {/* Barcode — auto-filled on every new row, and editable */}
                          <td style={{ padding: '4px 3px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input value={item.barcode} onChange={e => hook.updateItem(item.id, 'barcode', e.target.value)}
                                placeholder="Barcode" style={{ ...cellInput, width: '66px', fontFamily: 'DM Mono' }} />
                              <button onClick={() => hook.generateBarcode(item.id)} title="Generate a new barcode"
                                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 5px', cursor: 'pointer', color: G.muted, fontSize: '9px', whiteSpace: 'nowrap' }}>
                                Auto
                              </button>
                            </div>
                          </td>

                          {/* Cost */}
                          <td style={{ padding: '4px 3px' }}>
                            <input type="number" value={item.unit_cost === '' ? '' : item.unit_cost}
                              onChange={e => hook.updateItem(item.id, 'unit_cost', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="cost" min="0"
                              style={{ ...cellInput, width: '64px', ...(hook.missingCost(item) ? { borderColor: '#ef4444', background: '#fef2f2' } : {}) }} />
                          </td>

                          {/* GST% */}
                          <td style={{ padding: '4px 3px' }}>
                            <select value={item.gst_rate} onChange={e => hook.updateItem(item.id, 'gst_rate', parseFloat(e.target.value))}
                              style={{ ...cellInput, width: '56px', padding: '8px 4px' }}>
                              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '4px 3px', fontFamily: 'DM Mono', fontWeight: 600, color: '#1a0a2e', whiteSpace: 'nowrap' }}>
                            ₹{item.line_total.toLocaleString('en-IN')}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '4px 3px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => hook.duplicateItem(item.id)}
                              title="Copy this row below — same design, new colour"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.primary, padding: '4px' }}>
                              <Copy size={13} />
                            </button>
                            <button onClick={() => hook.removeItem(item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>

                        {/* Repeat this whole colour set in another size — one pick
                            creates every colour again, instead of copying row by row. */}
                        {isSetEnd && (
                          <tr style={{ background: '#f7fdfa', borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}></td>
                            <td colSpan={13} style={{ padding: '4px 6px' }}>
                              <span style={{ fontSize: '11px', color: '#059669', marginRight: '6px' }}>
                                ↳ repeat these {setSize} colours in size
                              </span>
                              <select
                                value=""
                                onChange={e => {
                                  const v = e.target.value === '__new' ? (window.prompt('Type the new size (e.g. 8XL, 50, 3XL-4XL):') || '').trim() : e.target.value
                                  if (v && item.groupId) {
                                    hook.duplicateGroupAsSize(item.groupId, v)
                                  }
                                }}
                                style={{ ...inputStyle, width: '110px', display: 'inline-block', borderColor: G.border, color: G.primary }}
                              >
                                <option value="">choose size…</option>
                                {allSizes.filter(s => s !== item.size).map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                                <option value="__new">+ New size…</option>
                              </select>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button onClick={hook.addItem}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: G.hover, border: `1px dashed ${G.border}`, borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: G.primary, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
                    <Plus size={15} /> Add Item
                  </button>
                  {hook.hasDraft && !hook.editing && (
                    <>
                      <span style={{ fontSize: '12px', color: G.muted }}>✓ Kept on this PC until saved — safe to leave this screen</span>
                      <button onClick={() => { if (window.confirm('Clear this purchase entry? Everything typed here will be removed.')) hook.resetForm() }}
                        style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '7px 14px', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        Clear form
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL — Bill Summary */}
            <div style={{ position: 'sticky', top: '24px', flex: '1 1 300px', maxWidth: '420px', marginLeft: 'auto' }}>
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

                {hook.emptyQtyCount > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', fontSize: '12.5px' }}>
                    {hook.emptyQtyCount} item{hook.emptyQtyCount > 1 ? 's have' : ' has'} no qty (red) and {hook.emptyQtyCount > 1 ? 'are' : 'is'} not counted.
                    <button onClick={hook.fillEmptyQty} style={{ display: 'block', marginTop: '6px', padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Set qty 1 on all of them
                    </button>
                  </div>
                )}

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
                        disabled={!!hook.editing}
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

                {hook.editing && (
                  <div style={{ fontSize: '12px', color: G.muted, marginBottom: '10px' }}>
                    Was ₹{hook.editing.netBefore.toLocaleString('en-IN')} · paid ₹{hook.editing.paid.toLocaleString('en-IN')}.
                    The supplier's due is worked out again from the new total.
                  </div>
                )}

                {/* Payment Status */}
                {!hook.editing && <div style={{ marginBottom: '12px' }}>
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
                </div>}

                {/* Website listing toggle removed at client request — purchased items
                    no longer auto-publish to the online catalogue. Products can still be
                    listed individually from Online Listings. */}

                {/* Editing a saved bill: the reason and Cancel sit right above Save. */}
              {hook.editing && (
                <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#6b21a8', fontSize: '14px' }}>✏️ Editing purchase bill {hook.editing.no}</div>
                      <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '2px' }}>
                        Change, copy, add or remove lines as in a new entry. Stock moves by the difference; stock already sold can't be taken off.
                        Copied or added lines become new products. Your new purchase (if any) is kept and comes back after.
                      </div>
                    </div>
                    <button onClick={hook.cancelEdit} style={{ padding: '8px 14px', background: 'white', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      Cancel edit
                    </button>
                  </div>
                  <input value={hook.editReason} onChange={e => hook.setEditReason(e.target.value)}
                    placeholder="Reason for the edit * (e.g. supplier sent 2 more pieces; wrong cost entered)"
                    style={{ ...inputStyle, marginTop: '10px', borderColor: hook.editReason.trim().length < 3 ? '#d8b4fe' : G.border }} />
                </div>
              )}
                {/* Save button */}
                <button
                  data-enter-submit
                  onClick={hook.editing ? saveEdit : hook.savePurchase}
                  disabled={hook.loading}
                  style={{ width: '100%', padding: '13px', background: hook.loading ? '#86efac' : G.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: hook.loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', transition: 'background 0.15s' }}
                >
                  {hook.loading ? 'Saving...' : hook.editing ? `Save changes to ${hook.editing.no}` : 'Save Purchase Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PURCHASE BILLS (print, edit here, history, delete) ────── */}
        {hook.tab === 'bills' && (
          <PurchaseBillsList onEdit={id => {
            if (hook.editing && hook.editing.id !== id && !window.confirm(`Leave the edit of ${hook.editing.no}? Its changes are not saved.`)) return
            void hook.startEdit(id)
          }} />
        )}
      </div>

      {editLabels && (
        <PrintLabelsModal products={editLabels} isOpen onClose={() => setEditLabels(null)} />
      )}

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
