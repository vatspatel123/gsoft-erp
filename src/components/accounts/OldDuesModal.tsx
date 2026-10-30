import { useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { S } from '../bills/billEditStyles'
import { money } from '../../utils/billEdits'
import { fmtDateTime } from '../../utils/date'

interface Row { id: string; at: string; who: string; bill: string; tender: string; amount: number; kind: 'Customer' | 'Wholesale' }

/**
 * Who paid what: every old pending amount collected between from and to (ISO times),
 * from customers (retail bills and exchanges) and from wholesale parties.
 */
export function OldDuesModal({ from, to, title, onClose }: { from: string; to: string; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const [c, w] = await Promise.all([
        supabase.from('customer_payments')
          .select('id, paid_at, amount, tender, customers(name, phone), sales(invoice_no), exchange_bills(exchange_no)')
          .gte('paid_at', from).lt('paid_at', to).order('paid_at', { ascending: false }),
        supabase.from('wholesale_payments')
          .select('id, paid_at, amount, tender, settled, wholesale_customers(name, business_name)')
          .gte('paid_at', from).lt('paid_at', to).order('paid_at', { ascending: false }),
      ])
      if (!live) return
      // If the joined lookup is refused, still list the payments (amount, time, method) without names.
      const cd = c.error
        ? (await supabase.from('customer_payments').select('id, paid_at, amount, tender').gte('paid_at', from).lt('paid_at', to).order('paid_at', { ascending: false })).data
        : c.data
      if (!live) return
      const out: Row[] = []
      for (const r of (cd || []) as any[]) {
        out.push({
          id: r.id, at: r.paid_at, kind: 'Customer', tender: String(r.tender || 'cash'), amount: Number(r.amount) || 0,
          who: [r.customers?.name, r.customers?.phone].filter(Boolean).join(' · ') || 'Customer',
          bill: r.sales?.invoice_no || r.exchange_bills?.exchange_no || '—',
        })
      }
      // Empty until WHOLESALE_PAYMENTS.sql has been run.
      for (const r of (w.error ? [] : w.data || []) as any[]) {
        out.push({
          id: r.id, at: r.paid_at, kind: 'Wholesale', tender: String(r.tender || 'cash'), amount: Number(r.amount) || 0,
          who: r.wholesale_customers?.business_name || r.wholesale_customers?.name || 'Wholesale party',
          bill: (r.settled || []).map((x: any) => x.invoice_no).join(', ') || '—',
        })
      }
      out.sort((a, b) => b.at.localeCompare(a.at))
      setRows(out)
    })()
    return () => { live = false }
  }, [from, to])

  const byTender = useMemo(() => {
    const t: Record<string, number> = {}
    for (const r of rows || []) t[r.tender] = (t[r.tender] || 0) + r.amount
    return t
  }, [rows])
  const total = (rows || []).reduce((s, r) => s + r.amount, 0)

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 820 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Old dues collected — {title}</div>
            <div style={S.sub}>Pending amounts customers and wholesale parties paid back in this period.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={S.body}>
          {rows === null ? (
            <div style={S.loading}><Loader2 size={18} className="spinner" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ ...S.muted, textAlign: 'center', padding: 24 }}>No old dues were collected in this period.</div>
          ) : (<>
            <div style={S.totals}>
              <span><b>{money(total)}</b> in {rows.length} payment{rows.length > 1 ? 's' : ''}</span>
              {Object.entries(byTender).map(([k, v]) => <span key={k} style={{ textTransform: 'capitalize' }}>{k}: <b>{money(v)}</b></span>)}
            </div>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>When</th><th style={S.th}>Paid by</th><th style={S.th}>For bill</th>
                <th style={S.th}>Method</th><th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.kind + r.id}>
                    <td style={S.td}>{fmtDateTime(new Date(r.at))}</td>
                    <td style={S.td}>{r.who}{r.kind === 'Wholesale' && <span style={{ ...S.muted, marginLeft: 6 }}>(wholesale)</span>}</td>
                    <td style={S.td}>{r.bill}</td>
                    <td style={{ ...S.td, textTransform: 'capitalize' }}>{r.tender}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                  </tr>))}
              </tbody>
            </table>
          </>)}
        </div>
      </div>
    </div>
  )
}
