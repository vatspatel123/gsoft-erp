import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, Search, Loader2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { editWholesale, wholesaleTotals, wholesaleLineTaxable, money, type WholesaleLine } from '../../utils/billEdits'
import { S } from './billEditStyles'

interface Props {
  billId: string
  onClose: () => void
  onSaved: (billId: string) => void
}

/**
 * Edit a wholesale bill: items (add, copy, change, remove), discount %, freight,
 * GST type and notes. The database (edit_wholesale) moves stock and the party's
 * pending amount by the difference and keeps the old version in the history.
 */
export function EditWholesaleModal({ billId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [bill, setBill] = useState<any>(null)
  const [lines, setLines] = useState<WholesaleLine[]>([])
  const [discountPct, setDiscountPct] = useState(0)
  const [freight, setFreight] = useState(0)
  const [gstType, setGstType] = useState('gst')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.from('wholesale_sales')
        .select('*, wholesale_customers(name, business_name), wholesale_sale_items(product_id, qty, unit_price, mrp, discount_pct, gst_rate, products(id, name, barcode, sku, size, stock_qty))')
        .eq('id', billId).single()
      if (!alive) return
      if (error || !data) { toast.error('Could not load this wholesale bill'); onClose(); return }
      setBill(data)
      setDiscountPct(Number(data.discount_pct) || 0)
      setFreight(Number(data.freight) || 0)
      setGstType(data.gst_type || 'gst')
      setNotes(data.notes || '')
      setLines((data.wholesale_sale_items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.products?.name || 'Product',
        barcode: i.products?.barcode || i.products?.sku,
        size: i.products?.size,
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        mrp: Number(i.mrp) || Number(i.unit_price),
        discount_pct: Number(i.discount_pct) || 0,
        gst_rate: Number(i.gst_rate) || 0,
        orig_qty: Number(i.qty),
        stock_qty: Number(i.products?.stock_qty) || 0,
      })))
      setLoading(false)
    })()
    return () => { alive = false }
    // Load once per bill (see EditSaleModal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId])

  const totals = useMemo(() => wholesaleTotals(lines, discountPct, freight), [lines, discountPct, freight])

  // Selling more than was on the bill needs that much more on the shelf.
  const stockProblems = useMemo(() => {
    const byProduct = new Map<string, { name: string; more: number; stock: number }>()
    for (const l of lines) {
      const e = byProduct.get(l.product_id) || { name: l.name, more: 0, stock: l.stock_qty }
      e.more += l.qty - l.orig_qty
      byProduct.set(l.product_id, e)
    }
    return [...byProduct.values()].filter(e => e.more > e.stock)
  }, [lines])

  const setLine = (i: number, patch: Partial<WholesaleLine>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const searchProducts = async () => {
    const q = query.trim().replace(/[,()%]/g, '')
    if (!q) return
    const { data } = await supabase.from('products')
      .select('id, name, barcode, sku, size, stock_qty, gst_rate, unit_price, mrp, wholesale_price')
      .eq('is_active', true)
      .or(`barcode.eq.${q},sku.eq.${q},name.ilike.%${q}%,design_no.ilike.%${q}%`)
      .limit(8)
    setResults(data || [])
    if (!data?.length) toast('Nothing found', { icon: '🔍' })
  }

  const addProduct = (p: any) => {
    const price = Number(p.wholesale_price) || Number(p.unit_price) || 0   // as the Wholesale screen prices it
    setLines(ls => {
      const at = ls.findIndex(l => l.product_id === p.id)
      if (at >= 0) return ls.map((l, j) => (j === at ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, {
        product_id: p.id, name: p.name, barcode: p.barcode || p.sku, size: p.size,
        qty: 1, unit_price: price, mrp: Number(p.mrp) || price, discount_pct: 0,
        gst_rate: Number(p.gst_rate) || 0, orig_qty: 0, stock_qty: Number(p.stock_qty) || 0,
      }]
    })
    setResults([]); setQuery('')
  }

  const save = async () => {
    if (!lines.length) { toast.error('A bill needs at least one item'); return }
    if (lines.some(l => !Number.isInteger(l.qty) || l.qty < 1)) { toast.error('Every quantity must be a whole number, 1 or more'); return }
    if (stockProblems.length) { toast.error(`Not enough stock of ${stockProblems[0].name}`); return }
    if (reason.trim().length < 3) { toast.error('Please write why this bill is being edited'); return }
    setSaving(true)
    const res = await editWholesale(billId, { discount_pct: discountPct, freight, gst_type: gstType, notes }, lines, reason.trim())
    setSaving(false)
    if (!res.ok) { toast.error(res.error, { duration: 6000 }); return }
    toast.success(`Bill ${bill.invoice_no} updated · net ${money(res.net)}`)
    onSaved(billId)
    onClose()
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit wholesale bill {bill?.invoice_no || ''}</div>
            <div style={S.sub}>
              {bill ? `${bill.wholesale_customers?.business_name || bill.wholesale_customers?.name || ''} · ` : ''}
              Stock and the party's pending amount change by the difference. The old version is kept in the bill's history.
            </div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {loading ? (
          <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading bill…</div>
        ) : (
          <div style={S.body}>
            <div style={S.section}>Items</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Item</th>
                    <th style={{ ...S.th, width: 80 }}>Qty</th>
                    <th style={{ ...S.th, width: 110 }}>Rate ₹</th>
                    <th style={{ ...S.th, width: 80 }}>Disc %</th>
                    <th style={{ ...S.th, width: 80 }}>GST %</th>
                    <th style={{ ...S.th, width: 110, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...S.th, width: 64 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.product_id + i}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div style={S.muted}>{[l.barcode, l.size, `stock ${l.stock_qty}`].filter(Boolean).join(' · ')}
                          {l.orig_qty !== l.qty && <span style={S.changed}> was {l.orig_qty}</span>}</div>
                      </td>
                      <td style={S.td}><input style={S.num} type="number" min={1} step={1} value={l.qty}
                        onChange={e => setLine(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                      <td style={S.td}><input style={S.num} type="number" min={0} step="0.01" value={l.unit_price}
                        onChange={e => setLine(i, { unit_price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td style={S.td}><input style={S.num} type="number" min={0} max={100} step="0.5" value={l.discount_pct}
                        onChange={e => setLine(i, { discount_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></td>
                      <td style={S.td}>
                        <select style={S.num} value={l.gst_rate} onChange={e => setLine(i, { gst_rate: Number(e.target.value) })}>
                          {[...new Set([0, 5, 12, 18, 28, l.gst_rate])].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>
                        {money(wholesaleLineTaxable(l) * (1 + (l.gst_rate || 0) / 100))}
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <button style={{ ...S.iconBtn, color: '#7c3aed' }} title="Copy this item below"
                          onClick={() => setLines(ls => [...ls.slice(0, i + 1), { ...ls[i], orig_qty: 0 }, ...ls.slice(i + 1)])}>
                          <Copy size={15} />
                        </button>
                        <button style={S.iconBtn} title="Remove item" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stockProblems.map(p => (
              <div key={p.name} style={S.error}>Not enough stock of {p.name}: {p.more} more needed, {p.stock} on the shelf.</div>
            ))}

            <div style={S.row}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Add item — scan barcode or type name / design no"
                data-enter="own" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} />
              <button style={S.btnOutline} onClick={searchProducts}><Search size={15} /> Find</button>
            </div>
            {results.length > 0 && (
              <div style={S.results}>
                {results.map(p => (
                  <button key={p.id} style={S.result} onClick={() => addProduct(p)}>
                    <Plus size={14} /> <b>{p.name}</b>
                    <span style={S.muted}>{[p.barcode, p.size, `stock ${p.stock_qty}`].filter(Boolean).join(' · ')}</span>
                    <span style={{ marginLeft: 'auto' }}>{money(Number(p.wholesale_price) || Number(p.unit_price) || 0)}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={S.grid2}>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Bill discount %</div>
                  <input style={{ ...S.input, width: '100%' }} type="number" min={0} max={100} step="0.5" value={discountPct}
                    onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>Freight ₹</div>
                  <input style={{ ...S.input, width: '100%' }} type="number" min={0} step="0.01" value={freight}
                    onChange={e => setFreight(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.section}>GST</div>
                  <select style={{ ...S.input, width: '100%' }} value={gstType} onChange={e => setGstType(e.target.value)}>
                    <option value="gst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={S.section}>Notes</div>
                <input style={{ ...S.input, width: '100%' }} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={S.totals}>
              <span>Subtotal {money(totals.subtotal)}</span>
              {totals.billDisc > 0 && <span>Discount − {money(totals.billDisc)}</span>}
              <span>GST + {money(totals.gst)}</span>
              {freight > 0 && <span>Freight + {money(freight)}</span>}
              <span>Round off {totals.roundOff >= 0 ? '+' : '−'} {money(Math.abs(totals.roundOff))}</span>
              <b style={{ fontSize: 16 }}>Net {money(totals.net)}</b>
              {Number(bill.net_amount) !== totals.net && <span style={S.changed}>was {money(Number(bill.net_amount))}</span>}
            </div>

            <div style={S.section}>Reason for the edit <span style={{ color: '#dc2626' }}>*</span></div>
            <textarea style={{ ...S.input, width: '100%', minHeight: 56, resize: 'vertical' }}
              placeholder="e.g. party added 6 more pieces; wrong rate entered"
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
