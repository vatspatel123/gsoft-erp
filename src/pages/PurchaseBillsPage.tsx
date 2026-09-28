import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Pencil, Search, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import { printPurchaseA4 } from '../utils/printA4Purchase'
import { money } from '../utils/billEdits'
import { EditPurchaseModal } from '../components/bills/EditPurchaseModal'
import { BillHistoryModal } from '../components/bills/BillHistoryModal'
import { S } from '../components/bills/billEditStyles'

/**
 * Every purchase bill in one place — there wasn't a list before, only each
 * supplier's history. Print on A4, edit, and see what was changed.
 */
export function PurchaseBillsPage() {
  const [bills, setBills] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<Record<string, { name: string; gstin?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [history, setHistory] = useState<{ id: string; no: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [b, s] = await Promise.all([
      supabase.from('purchase_bills')
        .select('id, purchase_no, supplier_id, supplier_invoice_no, supplier_invoice_date, net_amount, amount_paid, payment_status, edit_count, created_at')
        .order('created_at', { ascending: false }).limit(300),
      supabase.from('suppliers').select('id, name, gstin'),
    ])
    if (b.error) toast.error('Could not load purchase bills')
    setBills(b.data || [])
    setSuppliers(Object.fromEntries((s.data || []).map((x: any) => [x.id, { name: x.name, gstin: x.gstin }])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bills
    return bills.filter(b =>
      [b.purchase_no, b.supplier_invoice_no, suppliers[b.supplier_id]?.name].some(v => String(v || '').toLowerCase().includes(q)))
  }, [bills, suppliers, search])

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
    <Layout>
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", color: '#1a0a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Purchase Bills</h1>
            <div style={S.muted}>Print, edit and check the history of every purchase.</div>
          </div>
          <div style={{ ...S.row, minWidth: 280 }}>
            <Search size={16} color="#94a3b8" />
            <input style={{ ...S.input, flex: 1 }} placeholder="Purchase no, supplier or their invoice no"
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
                      <td style={S.td}>{new Date(b.supplier_invoice_date || b.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={S.td}>{suppliers[b.supplier_id]?.name || '—'}</td>
                      <td style={S.td}>{b.supplier_invoice_no || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(b.net_amount)}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: due > 0 ? '#b45309' : '#15803d' }}>{due > 0 ? money(due) : 'paid'}</td>
                      <td style={S.td}>
                        <div style={S.row}>
                          <button style={S.btnOutline} onClick={() => print(b)} title="Print on A4"><Printer size={14} /></button>
                          <button style={S.btnOutline} onClick={() => setEditing(b.id)}><Pencil size={14} /> Edit</button>
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

      {editing && <EditPurchaseModal billId={editing} onClose={() => setEditing(null)} onSaved={() => load()} />}
      {history && <BillHistoryModal type="purchase" billId={history.id} billNo={history.no} onClose={() => setHistory(null)} />}
    </Layout>
  )
}
