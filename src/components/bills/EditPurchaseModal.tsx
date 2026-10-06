import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, Search, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { editPurchase, purchaseTotals, money, type PurchaseLine } from '../../utils/billEdits'
import { S } from './billEditStyles'

interface Props {
  billId: string
  onClose: () => void
  onSaved: (billId: string) => void
}

/**
 * Edit a purchase bill the way it was entered: every column of every line, new
 * lines (new products, next barcode in sequence), supplier and invoice details,
 * discount and freight. Details typed on a line become the product's details.
 * Stock moves by the difference; stock already sold can't be taken off the bill.
 */
const SIZES = ['2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL', '2XL-3XL', '3XL-4XL', '4XL-5XL',
  '36', '38', '40', '42', '44', '46', '48', '50', 'FREE']
const isSeqCode = (c?: string) => /^\d{1,7}$/.test(String(c || '').trim())
const cellStyle = { ...S.num, padding: '6px 6px' }

export function EditPurchaseModal({ billId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [bill, setBill] = useState<any>(null)
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [discount, setDiscount] = useState(0)
  const [freight, setFreight] = useState(0)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [lastCode, setLastCode] = useState(0)   // highest sequence barcode in stock
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data, error }, sup] = await Promise.all([
        supabase.from('purchase_bills')
          .select('*, purchase_items(product_id, product_name, design_no, pcode, colour, size, barcode, qty, unit_cost, mrp, gst_rate, products(id, name, barcode, design_no, pcode, colour, size, mrp, wholesale_price, online_price, stock_qty, gst_rate))')
          .eq('id', billId).single(),
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('categories').select('name').order('name').then(({ data }) => setCategories((data || []).map(c => c.name))),
        supabase.from('products').select('barcode').not('barcode', 'is', null)
          .then(({ data }) => setLastCode(Math.max(0, ...(data || []).filter(r => isSeqCode(r.barcode)).map(r => Number(r.barcode))))),
      ])
      if (!alive) return
      if (error || !data) { toast.error('Could not load this purchase bill'); onClose(); return }
      setBill(data)
      setSuppliers(sup.data || [])
      setSupplierId(data.supplier_id || '')
      setInvoiceNo(data.supplier_invoice_no || '')
      setInvoiceDate(data.supplier_invoice_date || '')
      setDiscount(Number(data.discount_amount) || 0)
      setFreight(Number(data.freight) || 0)
      setNotes(data.notes || '')
      setLines((data.purchase_items || []).filter((i: any) => i.product_id).map((i: any) => ({
        product_id: i.product_id,
        key: Math.random().toString(36).slice(2),
        name: i.products?.name || i.product_name || 'Product',
        barcode: i.products?.barcode || i.barcode,
        size: i.products?.size ?? i.size,
        design_no: i.products?.design_no ?? i.design_no,
        colour: i.products?.colour ?? i.colour,
        pcode: i.products?.pcode ?? i.pcode ?? '',
        wholesale_price: i.products?.wholesale_price != null ? Number(i.products.wholesale_price) : undefined,
        online_price: i.products?.online_price != null ? Number(i.products.online_price) : undefined,
        mrp: Number(i.mrp ?? i.products?.mrp) || undefined,
        qty: Number(i.qty),
        unit_cost: Number(i.unit_cost),
        gst_rate: Number(i.gst_rate ?? i.products?.gst_rate) || 0,
        orig_qty: Number(i.qty),
        stock_qty: Number(i.products?.stock_qty) || 0,
      })))
      setLoading(false)
    })()
    return () => { alive = false }
    // Load once per bill. onClose is left out on purpose: callers pass a fresh
    // arrow each render, and reloading would wipe what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId])

  const totals = useMemo(() => purchaseTotals(lines, discount, freight), [lines, discount, freight])
  const paid = Number(bill?.amount_paid) || 0

  // Taking stock off a purchase can't take the shelf below zero.
  const stockProblems = useMemo(() => {
    const byProduct = new Map<string, { name: string; less: number; stock: number }>()
    for (const l of lines) {
      if (!l.product_id) continue                     // a new product: nothing to take off
      const e = byProduct.get(l.product_id) || { name: l.name, less: 0, stock: l.stock_qty }
      e.less += l.orig_qty - l.qty
      byProduct.set(l.product_id, e)
    }
    return [...byProduct.values()].filter(e => e.less > e.stock)
  }, [lines])
  // Lines removed altogether also give stock back to the supplier.
  const [removed, setRemoved] = useState<PurchaseLine[]>([])
  const removedProblems = removed.filter(r => !lines.some(l => l.product_id === r.product_id) && r.orig_qty > r.stock_qty)

  const setLine = (i: number, patch: Partial<PurchaseLine>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const removeLine = (i: number) => {
    if (lines[i].product_id) setRemoved(r => [...r, lines[i]])
    setLines(ls => ls.filter((_, j) => j !== i))
  }

  const searchProducts = async () => {
    const q = query.trim().replace(/[,()%]/g, '')
    if (!q) return
    const { data } = await supabase.from('products')
      .select('id, name, barcode, sku, size, design_no, colour, mrp, stock_qty, gst_rate, cost_price')
      .eq('is_active', true)
      .or(`barcode.eq.${q},sku.eq.${q},name.ilike.%${q}%,design_no.ilike.%${q}%`)
      .limit(8)
    setResults(data || [])
    if (!data?.length) toast('Nothing found — new products go through Purchase Entry', { icon: '🔍' })
  }

  const addProduct = (p: any) => {
    setLines(ls => {
      const at = ls.findIndex(l => l.product_id === p.id)
      if (at >= 0) return ls.map((l, j) => (j === at ? { ...l, qty: l.qty + 1 } : l))
      const wasOnBill = removed.find(r => r.product_id === p.id)
      return [...ls, {
        product_id: p.id, name: p.name, barcode: p.barcode || p.sku, size: p.size, design_no: p.design_no, colour: p.colour, mrp: Number(p.mrp) || undefined,
        qty: 1, unit_cost: Number(p.cost_price) || 0, gst_rate: Number(p.gst_rate) || 0,
        orig_qty: wasOnBill?.orig_qty || 0, stock_qty: Number(p.stock_qty) || 0,
      }]
    })
    setResults([]); setQuery('')
  }

  // A new line: a new product, with the next barcode in the shop's sequence.
  const addNewLine = () => setLines(ls => {
    const next = Math.max(lastCode, ...ls.filter(l => isSeqCode(l.barcode)).map(l => Number(l.barcode))) + 1
    const prev = ls[ls.length - 1]
    return [...ls, {
      product_id: '', key: Math.random().toString(36).slice(2), name: prev?.name || '', design_no: prev?.design_no || '',
      pcode: prev?.pcode || '', size: '', colour: '', barcode: String(next), mrp: prev?.mrp, qty: 1,
      unit_cost: prev?.unit_cost || 0, gst_rate: prev?.gst_rate ?? 5, orig_qty: 0, stock_qty: 0,
    }]
  })

  const save = async () => {
    if (!lines.length) { toast.error('A purchase bill needs at least one item'); return }
    if (lines.some(l => !Number.isInteger(l.qty) || l.qty < 1)) { toast.error('Every quantity must be a whole number, 1 or more'); return }
    if (lines.some(l => !String(l.name || '').trim())) { toast.error('Every item needs a product name'); return }
    if (lines.some(l => !String(l.barcode || '').trim())) { toast.error('Every item needs a barcode'); return }
    const codes = lines.map(l => String(l.barcode).trim())
    const dup = codes.find((c, i) => codes.indexOf(c) !== i)
    if (dup) { toast.error(`Barcode ${dup} is on two lines`); return }
    const problem = stockProblems[0] || removedProblems[0]
    if (problem) { toast.error(`${problem.name}: some of it is already sold, so it can't come off this bill`); return }
    if (reason.trim().length < 3) { toast.error('Please write why this bill is being edited'); return }

    const changes: Record<string, unknown> = {
      supplier_invoice_no: invoiceNo.trim(), supplier_invoice_date: invoiceDate || '',
      discount_amount: Math.round(discount * 100) / 100, freight: Math.round(freight * 100) / 100, notes: notes.trim(),
    }
    if ((supplierId || '') !== (bill.supplier_id || '')) changes.supplier_id = supplierId || ''

    setSaving(true)
    const res = await editPurchase(billId, changes, lines, reason.trim())
    setSaving(false)
    if (!res.ok) { toast.error(res.error, { duration: 6000 }); return }
    toast.success(`Purchase ${bill.purchase_no} updated · net ${money(res.net)}`)
    onSaved(billId)
    onClose()
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 1400 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit purchase {bill?.purchase_no || ''}</div>
            <div style={S.sub}>Stock moves by the difference. Supplier dues are worked out again from the new total and what's already been paid.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {loading ? (
          <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading purchase bill…</div>
        ) : (
          <div style={S.body}>
            {bill.edit_count > 0 && (
              <div style={S.note}>This bill has been edited {bill.edit_count} time{bill.edit_count > 1 ? 's' : ''} before.</div>
            )}

            <div style={S.grid2}>
              <div>
                <div style={S.section}>Supplier</div>
                <select style={{ ...S.input, width: '100%' }} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">— none —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Supplier invoice no</div>
                  <input style={{ ...S.input, width: '100%' }} value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Invoice date</div>
                  <input style={{ ...S.input, width: '100%' }} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={S.section}>Items</div>
            <div style={{ overflowX: 'auto' }}>
              <datalist id="edit-purchase-names">{categories.map(n => <option key={n} value={n} />)}</datalist>
              <datalist id="edit-purchase-sizes">{SIZES.map(sz => <option key={sz} value={sz} />)}</datalist>
              <table style={{ ...S.table, minWidth: 1180 }}>
                <thead>
                  <tr>
                    {['Product', 'Design', 'PCode', 'Size', 'Colour', 'MRP ₹', 'Wholesale', 'Online', 'Qty', 'Barcode', 'Cost ₹', 'GST %'].map(h =>
                      <th key={h} style={S.th}>{h}</th>)}
                    <th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...S.th, width: 34 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const txt = (k: keyof PurchaseLine, w: number, ph = '', extra: any = {}) => (
                      <td style={S.td}><input style={{ ...cellStyle, width: w }} value={(l[k] as any) ?? ''} placeholder={ph} {...extra}
                        onChange={e => setLine(i, { [k]: e.target.value } as any)} /></td>)
                    const num = (k: keyof PurchaseLine, w: number, ph = '') => (
                      <td style={S.td}><input style={{ ...cellStyle, width: w }} type="number" min={0} value={(l[k] as any) ?? ''} placeholder={ph}
                        onChange={e => setLine(i, { [k]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) } as any)} /></td>)
                    return (
                      <tr key={l.key || l.product_id + i} style={{ background: l.product_id ? undefined : '#f0fdf4' }}>
                        <td style={S.td}>
                          <input style={{ ...cellStyle, width: 120 }} list="edit-purchase-names" value={l.name} placeholder="Product"
                            onChange={e => setLine(i, { name: e.target.value })} />
                          <div style={{ ...S.muted, fontSize: 11 }}>
                            {l.product_id ? `in stock ${l.stock_qty}` : 'new product'}
                            {l.orig_qty !== l.qty && l.product_id && <span style={S.changed}> · was {l.orig_qty}</span>}
                          </div>
                        </td>
                        {txt('design_no', 76)}
                        {txt('pcode', 56)}
                        {txt('size', 66, '', { list: 'edit-purchase-sizes' })}
                        {txt('colour', 70)}
                        {num('mrp', 72)}
                        {num('wholesale_price', 72)}
                        {num('online_price', 72, l.mrp ? String(l.mrp) : '')}
                        <td style={S.td}><input style={{ ...cellStyle, width: 56, fontWeight: 700 }} type="number" min={1} step={1} value={l.qty}
                          onChange={e => setLine(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                        {txt('barcode', 76)}
                        <td style={S.td}><input style={{ ...cellStyle, width: 72 }} type="number" min={0} step="0.01" value={l.unit_cost}
                          onChange={e => setLine(i, { unit_cost: Math.max(0, Number(e.target.value) || 0) })} /></td>
                        <td style={S.td}>
                          <select style={{ ...cellStyle, width: 58 }} value={l.gst_rate} onChange={e => setLine(i, { gst_rate: Number(e.target.value) })}>
                            {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(l.qty * l.unit_cost)}</td>
                        <td style={S.td}>
                          <button style={S.iconBtn} title="Remove item" onClick={() => removeLine(i)}><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <button style={S.btnOutline} onClick={addNewLine}><Plus size={15} /> Add item</button>
            </div>
            {[...stockProblems, ...removedProblems.map(r => ({ name: r.name, less: r.orig_qty, stock: r.stock_qty }))].map(p => (
              <div key={p.name} style={S.error}>
                {p.name}: taking off {p.less}, but only {p.stock} left on the shelf — the rest is already sold.
              </div>
            ))}

            <div style={S.row}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Add an existing product — scan barcode or type name / design no"
                data-enter="own" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
              <button style={S.btnOutline} onClick={searchProducts}><Search size={15} /> Find</button>
            </div>
            {results.length > 0 && (
              <div style={S.results}>
                {results.map(p => (
                  <button key={p.id} style={S.result} onClick={() => addProduct(p)}>
                    <Plus size={14} /> <b>{p.name}</b>
                    <span style={S.muted}>{[p.barcode, p.size, `stock ${p.stock_qty}`].filter(Boolean).join(' · ')}</span>
                    <span style={{ marginLeft: 'auto' }}>{money(p.cost_price)}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={S.grid2}>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Discount ₹</div>
                  <input style={{ ...S.input, width: '100%' }} type="number" min={0} step="0.01" value={discount}
                    onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Freight ₹</div>
                  <input style={{ ...S.input, width: '100%' }} type="number" min={0} step="0.01" value={freight}
                    onChange={e => setFreight(Math.max(0, Number(e.target.value) || 0))} />
                </div>
              </div>
              <div>
                <div style={S.section}>Notes</div>
                <input style={{ ...S.input, width: '100%' }} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={S.totals}>
              <span>Subtotal {money(totals.subtotal)}</span>
              <span>GST + {money(totals.gst)}</span>
              <span>Round off {totals.roundOff >= 0 ? '+' : '−'} {money(Math.abs(totals.roundOff))}</span>
              <b style={{ fontSize: 16 }}>Net {money(totals.net)}</b>
              {Number(bill.net_amount) !== totals.net && <span style={S.changed}>was {money(Number(bill.net_amount))}</span>}
              <span style={{ fontWeight: 600, color: paid >= totals.net ? '#15803d' : '#b45309' }}>
                Paid {money(paid)} · {paid >= totals.net ? 'settled' : `due ${money(totals.net - paid)}`}
              </span>
            </div>

            <div style={S.section}>Reason for the edit <span style={{ color: '#dc2626' }}>*</span></div>
            <textarea style={{ ...S.input, width: '100%', minHeight: 56, resize: 'vertical' }}
              placeholder="e.g. supplier short-shipped 2 pieces; wrong cost entered"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        )}

        <div style={S.foot}>
          <button style={S.btnOutline} onClick={onClose} disabled={saving}>Cancel</button>
          <button data-enter-submit style={S.btnPrimary} onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
