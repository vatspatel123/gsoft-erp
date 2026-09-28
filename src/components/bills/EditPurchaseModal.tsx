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
 * Edit a purchase bill: items (qty, cost, GST), supplier and invoice details,
 * discount and freight. Stock moves by the difference; stock that has already
 * been sold can't be taken off the bill. Brand-new products still go through
 * Purchase Entry, which gives them barcodes and labels.
 */
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data, error }, sup] = await Promise.all([
        supabase.from('purchase_bills')
          .select('*, purchase_items(product_id, product_name, size, barcode, qty, unit_cost, gst_rate, products(id, name, barcode, size, stock_qty, gst_rate))')
          .eq('id', billId).single(),
        supabase.from('suppliers').select('id, name').order('name'),
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
        name: i.products?.name || i.product_name || 'Product',
        barcode: i.barcode || i.products?.barcode,
        size: i.size || i.products?.size,
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
    setRemoved(r => [...r, lines[i]])
    setLines(ls => ls.filter((_, j) => j !== i))
  }

  const searchProducts = async () => {
    const q = query.trim().replace(/[,()%]/g, '')
    if (!q) return
    const { data } = await supabase.from('products')
      .select('id, name, barcode, sku, size, stock_qty, gst_rate, cost_price')
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
        product_id: p.id, name: p.name, barcode: p.barcode || p.sku, size: p.size,
        qty: 1, unit_cost: Number(p.cost_price) || 0, gst_rate: Number(p.gst_rate) || 0,
        orig_qty: wasOnBill?.orig_qty || 0, stock_qty: Number(p.stock_qty) || 0,
      }]
    })
    setResults([]); setQuery('')
  }

  const save = async () => {
    if (!lines.length) { toast.error('A purchase bill needs at least one item'); return }
    if (lines.some(l => !Number.isInteger(l.qty) || l.qty < 1)) { toast.error('Every quantity must be a whole number, 1 or more'); return }
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
      <div style={S.card} onClick={e => e.stopPropagation()}>
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
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Item</th>
                    <th style={{ ...S.th, width: 80 }}>Qty</th>
                    <th style={{ ...S.th, width: 110 }}>Cost ₹</th>
                    <th style={{ ...S.th, width: 80 }}>GST %</th>
                    <th style={{ ...S.th, width: 110, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...S.th, width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.product_id + i}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div style={S.muted}>{[l.barcode, l.size, `in stock ${l.stock_qty}`].filter(Boolean).join(' · ')}
                          {l.orig_qty !== l.qty && <span style={S.changed}> was {l.orig_qty}</span>}</div>
                      </td>
                      <td style={S.td}><input style={S.num} type="number" min={1} step={1} value={l.qty}
                        onChange={e => setLine(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                      <td style={S.td}><input style={S.num} type="number" min={0} step="0.01" value={l.unit_cost}
                        onChange={e => setLine(i, { unit_cost: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td style={S.td}>
                        <select style={S.num} value={l.gst_rate} onChange={e => setLine(i, { gst_rate: Number(e.target.value) })}>
                          {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(l.qty * l.unit_cost)}</td>
                      <td style={S.td}>
                        <button style={S.iconBtn} title="Remove item" onClick={() => removeLine(i)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {[...stockProblems, ...removedProblems.map(r => ({ name: r.name, less: r.orig_qty, stock: r.stock_qty }))].map(p => (
              <div key={p.name} style={S.error}>
                {p.name}: taking off {p.less}, but only {p.stock} left on the shelf — the rest is already sold.
              </div>
            ))}

            <div style={S.row}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Add an existing product — scan barcode or type name / design no"
                value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
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
          <button style={S.btnPrimary} onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
