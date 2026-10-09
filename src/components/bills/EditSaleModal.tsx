import { useEffect, useMemo, useState } from 'react'
import { X, Lock, Unlock, Plus, Trash2, Search, Loader2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { editSale, saleTotals, saleLineTotal, money, type SaleLine } from '../../utils/billEdits'
import { S } from './billEditStyles'

interface Props {
  saleId: string
  onClose: () => void
  /** Called after a successful save with the bill id, so the caller can reload or reprint. */
  onSaved: (saleId: string) => void
}

/**
 * Edit a sales bill: items, customer, bill discount, payment split and — with
 * the admin password — the salesman. The database applies it in one go and
 * keeps the previous version in the bill's history.
 */
export function EditSaleModal({ saleId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [sale, setSale] = useState<any>(null)
  const [lines, setLines] = useState<SaleLine[]>([])
  const [customer, setCustomer] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [phone, setPhone] = useState('')
  const [salesmen, setSalesmen] = useState<{ id: string; name: string }[]>([])
  const [salesmanId, setSalesmanId] = useState('')
  const [salesmanUnlocked, setSalesmanUnlocked] = useState(false)
  const [authPw, setAuthPw] = useState('')
  const [discount, setDiscount] = useState(0)
  const [tenders, setTenders] = useState({ cash: 0, card: 0, upi: 0 })
  const [reason, setReason] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data, error }, staff] = await Promise.all([
        supabase.from('sales')
          .select('*, customers(id, name, phone), sale_items(product_id, qty, unit_price, discount_pct, gst_rate, products(id, name, barcode, sku, size, stock_qty, gst_rate))')
          .eq('id', saleId).single(),
        supabase.from('users').select('id, name').eq('is_active', true).order('name'),
      ])
      if (!alive) return
      if (error || !data) { toast.error('Could not load this bill'); onClose(); return }
      setSale(data)
      setCustomer(data.customers || null)
      setPhone(data.customers?.phone || '')
      setSalesmanId(data.salesman_id || '')
      setSalesmen(staff.data || [])
      setDiscount(Number(data.discount_amount) || 0)
      setTenders({ cash: Number(data.cash_amount) || 0, card: Number(data.card_amount) || 0, upi: Number(data.upi_amount) || 0 })
      setLines((data.sale_items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.products?.name || 'Product',
        barcode: i.products?.barcode || i.products?.sku,
        size: i.products?.size,
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        discount_pct: Number(i.discount_pct) || 0,
        gst_rate: Number(i.products?.gst_rate ?? i.gst_rate) || 0,
        orig_qty: Number(i.qty),
        stock_qty: Number(i.products?.stock_qty) || 0,
      })))
      setLoading(false)
    })()
    return () => { alive = false }
    // Load once per bill. onClose is left out on purpose: callers pass a fresh
    // arrow each render, and reloading would wipe what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId])

  const totals = useMemo(() => saleTotals(lines, discount, tenders), [lines, discount, tenders])
  const minDiscount = (Number(sale?.loyalty_points_used) || 0) * 0.25
  const salesmanChanged = (salesmanId || '') !== (sale?.salesman_id || '')
  const customerChanged = (customer?.id || '') !== (sale?.customer_id || '')

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

  const setLine = (i: number, patch: Partial<SaleLine>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const findCustomer = async () => {
    const clean = phone.replace(/\D/g, '').slice(-10)
    if (clean.length !== 10) { toast.error('Enter a 10-digit phone number'); return }
    const { data } = await supabase.from('customers').select('id, name, phone').eq('phone', clean).maybeSingle()
    if (data) { setCustomer(data); toast.success(`Customer: ${data.name}`) }
    else toast.error('No customer with that number — add them in Customers first')
  }

  const searchProducts = async () => {
    const q = query.trim().replace(/[,()%]/g, '')
    if (!q) return
    const { data } = await supabase.from('products')
      .select('id, name, barcode, sku, size, stock_qty, gst_rate, unit_price, mrp')
      .eq('is_active', true)
      .or(`barcode.eq.${q},sku.eq.${q},name.ilike.%${q}%,design_no.ilike.%${q}%`)
      .limit(8)
    setResults(data || [])
    if (!data?.length) toast('Nothing found', { icon: '🔍' })
  }

  const addProduct = (p: any) => {
    setLines(ls => {
      const at = ls.findIndex(l => l.product_id === p.id)
      if (at >= 0) return ls.map((l, j) => (j === at ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, {
        product_id: p.id, name: p.name, barcode: p.barcode || p.sku, size: p.size,
        qty: 1, unit_price: Number(p.unit_price ?? p.mrp) || 0, discount_pct: 0,
        gst_rate: Number(p.gst_rate) || 0, orig_qty: 0, stock_qty: Number(p.stock_qty) || 0,
      }]
    })
    setResults([]); setQuery('')
  }

  const payAllBy = (kind: 'cash' | 'card' | 'upi') =>
    setTenders({ cash: 0, card: 0, upi: 0, [kind]: totals.net } as any)

  const save = async () => {
    if (!lines.length) { toast.error('A bill needs at least one item'); return }
    if (lines.some(l => !Number.isInteger(l.qty) || l.qty < 1)) { toast.error('Every quantity must be a whole number, 1 or more'); return }
    if (stockProblems.length) { toast.error(`Not enough stock of ${stockProblems[0].name}`); return }
    if (discount < minDiscount) { toast.error(`Discount can't go below ${money(minDiscount)} — loyalty points were used`); return }
    if (reason.trim().length < 3) { toast.error('Please write why this bill is being edited'); return }
    if (salesmanChanged && !authPw) { toast.error('Changing the salesman needs the admin password'); return }

    // Save what the shop kept; change handed back is not income.
    const changes: Record<string, unknown> = {
      discount_amount: Math.round(discount * 100) / 100,
      cash_amount: totals.kept.cash, card_amount: totals.kept.card, upi_amount: totals.kept.upi,
    }
    if (customerChanged) changes.customer_id = customer?.id || ''
    if (salesmanChanged) changes.salesman_id = salesmanId || ''

    setSaving(true)
    const res = await editSale(saleId, changes, lines, reason.trim(),
      salesmanChanged ? { login: '', password: authPw } : undefined)
    setSaving(false)
    if (!res.ok) { toast.error(res.error, { duration: 6000 }); return }
    toast.success(`Bill ${sale.invoice_no} updated${res.udhar > 0 ? ` · pending ${money(res.udhar)}` : ''}`)
    onSaved(saleId)
    onClose()
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit bill {sale?.invoice_no || ''}</div>
            <div style={S.sub}>Stock, pending amount and loyalty points are adjusted by the difference. The old version is kept in the bill's history.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {loading ? (
          <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading bill…</div>
        ) : (
          <div style={S.body}>
            {sale.edit_count > 0 && (
              <div style={S.note}>This bill has been edited {sale.edit_count} time{sale.edit_count > 1 ? 's' : ''} before.</div>
            )}

            {/* ── items ─────────────────────────────────────────────── */}
            <div style={S.section}>Items</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Item</th>
                    <th style={{ ...S.th, width: 80 }}>Qty</th>
                    <th style={{ ...S.th, width: 110 }}>Rate ₹</th>
                    <th style={{ ...S.th, width: 80 }}>Disc %</th>
                    <th style={{ ...S.th, width: 110, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...S.th, width: 64 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.product_id + i}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div style={S.muted}>{[l.barcode, l.size].filter(Boolean).join(' · ')}
                          {l.orig_qty !== l.qty && <span style={S.changed}> was {l.orig_qty}</span>}</div>
                      </td>
                      <td style={S.td}><input style={S.num} type="number" min={1} step={1} value={l.qty}
                        onChange={e => setLine(i, { qty: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                      <td style={S.td}><input style={S.num} type="number" min={0} step="0.01" value={l.unit_price}
                        onChange={e => setLine(i, { unit_price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td style={S.td}><input style={S.num} type="number" min={0} max={100} step="0.5" value={l.discount_pct}
                        onChange={e => setLine(i, { discount_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(saleLineTotal(l))}</td>
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
                    <span style={{ marginLeft: 'auto' }}>{money(p.unit_price ?? p.mrp)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── customer & salesman ──────────────────────────────── */}
            <div style={S.grid2}>
              <div>
                <div style={S.section}>Customer</div>
                <div style={S.row}>
                  <input style={{ ...S.input, flex: 1 }} placeholder="Phone number" value={phone}
                    data-enter="own" onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && findCustomer()} />
                  <button style={S.btnOutline} onClick={findCustomer}>Find</button>
                </div>
                <div style={S.muted}>
                  {customer ? <>{customer.name} · {customer.phone}{' '}
                    <button style={S.link} onClick={() => { setCustomer(null); setPhone('') }}>make walk-in</button></> : 'Walk-in customer'}
                  {customerChanged && <span style={S.changed}> (changed)</span>}
                </div>
              </div>

              <div>
                <div style={S.section}>Salesman</div>
                {!salesmanUnlocked ? (
                  <div style={S.row}>
                    <div style={{ ...S.input, flex: 1, background: '#f8fafc' }}>
                      {salesmen.find(s => s.id === salesmanId)?.name || '—'}
                    </div>
                    <button style={S.btnOutline} onClick={() => setSalesmanUnlocked(true)}><Lock size={14} /> Change</button>
                  </div>
                ) : (
                  <>
                    <select style={{ ...S.input, width: '100%' }} value={salesmanId} onChange={e => setSalesmanId(e.target.value)}>
                      <option value="">— none —</option>
                      {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {salesmanChanged && (
                      <div style={S.authBox}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}><Unlock size={13} /> Admin password</div>
                        <input style={{ ...S.input, width: '100%' }} type="password" placeholder="Admin password" autoComplete="new-password"
                          value={authPw} onChange={e => setAuthPw(e.target.value)} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── discount & payment ───────────────────────────────── */}
            <div style={S.grid2}>
              <div>
                <div style={S.section}>Bill discount ₹</div>
                <input style={{ ...S.input, width: '100%' }} type="number" min={minDiscount} step="0.01" value={discount}
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
                <div style={S.muted}>
                  Includes any coupon, points or store credit used.
                  {minDiscount > 0 && <> Can't go below {money(minDiscount)} (loyalty points already redeemed).</>}
                </div>
              </div>
              <div>
                <div style={S.section}>Payment received</div>
                {(['cash', 'upi', 'card'] as const).map(k => (
                  <div key={k} style={{ ...S.row, marginBottom: 6 }}>
                    <span style={{ width: 44, textTransform: 'uppercase', fontSize: 12, fontWeight: 600 }}>{k}</span>
                    <input style={{ ...S.input, flex: 1 }} type="number" min={0} step="0.01" value={tenders[k]}
                      onChange={e => setTenders(t => ({ ...t, [k]: Math.max(0, Number(e.target.value) || 0) }))} />
                    <button style={S.btnTiny} onClick={() => payAllBy(k)}>all</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.totals}>
              <span>Subtotal {money(totals.subtotal)}</span>
              <span>Discount − {money(totals.discount)}</span>
              <span>GST inside {money(totals.gst)}</span>
              <b style={{ fontSize: 16 }}>Net {money(totals.net)}</b>
              {Number(sale.net_amount) !== totals.net && <span style={S.changed}>was {money(Number(sale.net_amount))}</span>}
              <span style={{ color: totals.udhar > 0 ? '#b45309' : '#15803d', fontWeight: 600 }}>
                {totals.udhar > 0 ? `Pending ${money(totals.udhar)}` : 'Fully paid'}
                {totals.change > 0 && ` · change ${money(totals.change)} (saved as ${money(totals.paid)})`}
              </span>
            </div>

            <div style={S.section}>Reason for the edit <span style={{ color: '#dc2626' }}>*</span></div>
            <textarea style={{ ...S.input, width: '100%', minHeight: 56, resize: 'vertical' }}
              placeholder="e.g. customer returned one piece at the counter; wrong size entered"
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
