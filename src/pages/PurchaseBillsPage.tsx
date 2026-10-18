import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Printer, Pencil, Search, Loader2, Trash2, Tag } from 'lucide-react'
import { PrintLabelsModal } from '../components/inventory/PrintLabelsModal'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { printPurchaseA4 } from '../utils/printA4Purchase'
import { money } from '../utils/billEdits'
import { EditPurchaseModal } from '../components/bills/EditPurchaseModal'
import { BillHistoryModal } from '../components/bills/BillHistoryModal'
import { DeleteBillModal } from '../components/bills/DeleteBillModal'
import { S } from '../components/bills/billEditStyles'
import { fmtDate } from '../utils/date'
import { useLiveRefresh } from '../hooks/useLiveRefresh'
import { writeLocal, seedLocal } from '../utils/localStore'

/**
 * Every purchase bill in one place — there wasn't a list before, only each
 * supplier's history. Print on A4, edit, and see what was changed.
 */
export function PurchaseBillsList({ onEdit }: { onEdit?: (billId: string) => void } = {}) {
  const [bills, setBills] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<Record<string, { name: string; gstin?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [history, setHistory] = useState<{ id: string; no: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; no: string } | null>(null)
  const [labels, setLabels] = useState<any[] | null>(null)
  const [itemHits, setItemHits] = useState<Set<string> | null>(null)   // bills holding an item whose design / barcode / name matches the search

  // Search also looks inside the bills: a design number, barcode or product name finds the purchase it came in.
  useEffect(() => {
    const q = search.trim().replace(/[",()%]/g, ' ').trim()
    if (q.length < 2) { setItemHits(null); return }
    let stale = false
    const t = setTimeout(async () => {
      const { data } = await supabase.from('purchase_items').select('purchase_id')
        .or(['design_no', 'barcode', 'product_name', 'pcode'].map(f => `${f}.ilike."%${q}%"`).join(',')).limit(500)
      if (!stale) setItemHits(new Set((data || []).map((r: any) => r.purchase_id)))
    }, 300)
    return () => { stale = true; clearTimeout(t) }
  }, [search])

  const openLabels = async (bill: any) => {
    const { data, error } = await supabase.from('purchase_items')
      .select('product_id, product_name, design_no, colour, size, barcode, qty, mrp, products(id, name, barcode, sku, design_no, pcode, colour, size, mrp, unit_price)')
      .eq('purchase_id', bill.id)
    if (error || !data?.length) { toast.error('Could not load this bill\'s items'); return }
    setLabels(data.map((i: any, n: number) => {
      const p = i.products || {}
      return {
        id: p.id || `${bill.id}-${n}`, name: p.name || i.product_name, design_no: p.design_no || i.design_no || '',
        colour: p.colour || i.colour || '', size: p.size || i.size || '', pcode: p.pcode || '',
        mrp: p.mrp || i.mrp || '', unit_price: p.unit_price || i.mrp || '', barcode: p.barcode || i.barcode || p.sku || '',
        batch_no: '', defaultCopies: Number(i.qty) || 1, initialCopies: Number(i.qty) || 1,
      }
    }))
  }

  const fresh = useRef(false)   // the server has answered; the PC's copy is older
  const onScreen = useRef(false)   // bills are on screen: refresh quietly
  const load = useCallback(async () => {
    if (!onScreen.current) setLoading(true)
    const [b, s] = await Promise.all([
      supabase.from('purchase_bills')
        .select('id, purchase_no, supplier_id, supplier_invoice_no, supplier_invoice_date, net_amount, amount_paid, payment_status, edit_count, created_at')
        .order('created_at', { ascending: false }).limit(300),
      supabase.from('suppliers').select('id, name, gstin'),
    ])
    if (b.error) toast.error('Could not load purchase bills')
    setBills(b.data || [])
    const sup = Object.fromEntries((s.data || []).map((x: any) => [x.id, { name: x.name, gstin: x.gstin }]))
    setSuppliers(sup)
    if (!b.error) { fresh.current = true; onScreen.current = true; void writeLocal('purchasebills:list', { bills: b.data || [], sup }) }
    setLoading(false)
  }, [])

  // Open with this PC's copy of the bills; the load below replaces it.
  useEffect(() => {
    seedLocal<{ bills: any[]; sup: any }>('purchasebills:list',
      d => { setBills(d.bills); setSuppliers(d.sup); setLoading(false); onScreen.current = true }, () => fresh.current)
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(['purchase_bills'], load)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills
    return bills.filter(b =>
      itemHits?.has(b.id) ||
      [b.purchase_no, b.supplier_invoice_no, suppliers[b.supplier_id]?.name].some(v => String(v || '').toLowerCase().includes(q)))
  }, [bills, suppliers, search, itemHits])

  const print = async (bill: any) => {
    const { data: items } = await supabase.from('purchase_items')
      .select('product_id, product_name, design_no, colour, size, qty, unit_cost, gst_rate')
      .eq('purchase_id', bill.id)
    const ids = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))]
    const { data: prods } = ids.length ? await supabase.from('products').select('id, hsn_code').in('id', ids) : { data: [] }
    const hsn = Object.fromEntries((prods || []).map((p: any) => [p.id, p.hsn_code]))
    printPurchaseA4({
      kind: 'purchase',
      docNo: bill.purchase_no,
      date: bill.supplier_invoice_date || bill.created_at,
      supplierName: suppliers[bill.supplier_id]?.name || '',
      supplierGstin: suppliers[bill.supplier_id]?.gstin,
      origBillNo: bill.supplier_invoice_no,
      origDate: bill.supplier_invoice_date,
      items: (items || []).map((it: any) => ({
        name: [it.product_name, it.design_no, it.colour, it.size].filter(Boolean).join(' · '),
        hsn: hsn[it.product_id] || '',
        qty: Number(it.qty) || 0,
        rate: Number(it.unit_cost) || 0,
        gstPct: Number(it.gst_rate) || 0,
      })),
    })
  }

  return (
    <>
      <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a0a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Purchase Bills</div>
            <div style={S.muted}>Print, edit and check the history of every purchase.</div>
          </div>
          <div style={{ ...S.row, minWidth: 280 }}>
            <Search size={16} color="#94a3b8" />
            <input style={{ ...S.input, flex: 1 }} placeholder="Purchase no, supplier, invoice no, design no or barcode"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #f3e8ff', borderRadius: 14, overflowX: 'auto' }}>
          {loading ? (
            <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading…</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Purchase no</th>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Supplier</th>
                  <th style={S.th}>Their invoice</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Net</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Due</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(b => {
                  const due = Math.max(0, Number(b.net_amount) - Number(b.amount_paid || 0))
                  return (
                    <tr key={b.id}>
                      <td style={S.td}>
                        <b>{b.purchase_no}</b>
                        {b.edit_count > 0 && (
                          <div><button style={S.badge} onClick={() => setHistory({ id: b.id, no: b.purchase_no })}>
                            Edited {b.edit_count}× · history
                          </button></div>
                        )}
                      </td>
                      <td style={S.td}>{fmtDate(new Date(b.supplier_invoice_date || b.created_at))}</td>
                      <td style={S.td}>{suppliers[b.supplier_id]?.name || '—'}</td>
                      <td style={S.td}>{b.supplier_invoice_no || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(b.net_amount)}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: due > 0 ? '#b45309' : '#15803d' }}>{due > 0 ? money(due) : 'paid'}</td>
                      <td style={S.td}>
                        <div style={S.row}>
                          <button style={S.btnOutline} onClick={() => print(b)} title="Print on A4"><Printer size={14} /></button>
                          <button style={S.btnOutline} onClick={() => openLabels(b)} title="Print barcode labels"><Tag size={14} /></button>
                          <button style={S.btnOutline} onClick={() => (onEdit ? onEdit(b.id) : setEditing(b.id))}><Pencil size={14} /> Edit</button>
                          <button style={{ ...S.btnOutline, color: '#dc2626', borderColor: '#fecaca' }} title="Delete this purchase bill"
                            onClick={() => setDeleting({ id: b.id, no: b.purchase_no })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!shown.length && (
                  <tr><td style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }} colSpan={7}>No purchase bills found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {labels && <PrintLabelsModal products={labels} isOpen onClose={() => setLabels(null)} />}
      {editing && <EditPurchaseModal billId={editing} onClose={() => setEditing(null)} onSaved={() => load()} />}
      {deleting && <DeleteBillModal type="purchase" billId={deleting.id} billNo={deleting.no} onClose={() => setDeleting(null)} onDeleted={() => load()} />}
      {history && <BillHistoryModal type="purchase" billId={history.id} billNo={history.no} onClose={() => setHistory(null)} />}
    </>
  )
}
