import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { billHistory, money, type BillEdit } from '../../utils/billEdits'
import { S } from './billEditStyles'
import { fmtDateTime } from '../../utils/date'

interface Props {
  type: 'sale' | 'purchase'
  billId: string
  billNo: string
  onClose: () => void
}

/** Every edit made to one bill, newest first: who, when, why, and what changed. */
export function BillHistoryModal({ type, billId, billNo, onClose }: Props) {
  const [edits, setEdits] = useState<BillEdit[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      const list = await billHistory(type, billId)
      // Item lines store product ids; look the names up once for all edits.
      const ids = new Set<string>()
      const people = new Set<string>()
      for (const e of list) for (const side of [e.before, e.after]) {
        for (const i of side.items || []) if (i.product_id) ids.add(i.product_id)
        for (const k of ['customer_id', 'salesman_id', 'supplier_id']) if (side.bill?.[k]) people.add(side.bill[k])
      }
      const [prods, custs, staff, sups] = await Promise.all([
        ids.size ? supabase.from('products').select('id, name, size').in('id', [...ids]) : { data: [] },
        people.size ? supabase.from('customers').select('id, name').in('id', [...people]) : { data: [] },
        people.size ? supabase.from('users').select('id, name').in('id', [...people]) : { data: [] },
        people.size ? supabase.from('suppliers').select('id, name').in('id', [...people]) : { data: [] },
      ])
      const n: Record<string, string> = {}
      for (const p of prods.data || []) n[p.id] = [p.name, p.size].filter(Boolean).join(' · ')
      for (const r of [...(custs.data || []), ...(staff.data || []), ...(sups.data || [])]) n[r.id] = r.name
      if (!alive) return
      setNames(n)
      setEdits(list)
    })()
    return () => { alive = false }
  }, [type, billId])

  const who = (id?: string | null) => (id ? names[id] || 'unknown' : 'none')

  const itemChanges = (e: BillEdit) => {
    const qty = (items: any[]) => {
      const m = new Map<string, { q: number; price: number }>()
      for (const i of items || []) {
        const cur = m.get(i.product_id) || { q: 0, price: 0 }
        m.set(i.product_id, { q: cur.q + Number(i.qty), price: Number(i.unit_price ?? i.unit_cost) })
      }
      return m
    }
    const b = qty(e.before.items), a = qty(e.after.items)
    const out: string[] = []
    for (const id of new Set([...b.keys(), ...a.keys()])) {
      const x = b.get(id), y = a.get(id), name = who(id)
      if (!x) out.push(`Added ${name} × ${y!.q} at ${money(y!.price)}`)
      else if (!y) out.push(`Removed ${name} (was × ${x.q})`)
      else {
        if (x.q !== y.q) out.push(`${name}: qty ${x.q} → ${y.q}`)
        if (x.price !== y.price) out.push(`${name}: rate ${money(x.price)} → ${money(y.price)}`)
      }
    }
    return out
  }

  const headerChanges = (e: BillEdit) => {
    const b = e.before.bill || {}, a = e.after.bill || {}
    const out: string[] = []
    const diff = (label: string, k: string, fmt: (v: any) => string = v => String(v ?? '—')) => {
      if (String(b[k] ?? '') !== String(a[k] ?? '')) out.push(`${label}: ${fmt(b[k])} → ${fmt(a[k])}`)
    }
    if (type === 'sale') {
      diff('Customer', 'customer_id', v => (v ? who(v) : 'walk-in'))
      diff('Salesman', 'salesman_id', v => who(v))
      diff('Discount', 'discount_amount', v => money(Number(v)))
      diff('Cash', 'cash_amount', v => money(Number(v)))
      diff('UPI', 'upi_amount', v => money(Number(v)))
      diff('Card', 'card_amount', v => money(Number(v)))
      diff('Pending', 'credit_amount', v => money(Number(v)))
    } else {
      diff('Supplier', 'supplier_id', v => who(v))
      diff('Supplier invoice', 'supplier_invoice_no')
      diff('Invoice date', 'supplier_invoice_date')
      diff('Discount', 'discount_amount', v => money(Number(v)))
      diff('Freight', 'freight', v => money(Number(v)))
    }
    diff('Net', 'net_amount', v => money(Number(v)))
    return out
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit history · {billNo}</div>
            <div style={S.sub}>Kept permanently. Edits can't be deleted from here.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={S.body}>
          {!edits ? (
            <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading…</div>
          ) : edits.length === 0 ? (
            <div style={S.muted}>This bill has never been edited.</div>
          ) : edits.map(e => (
            <div key={e.id} style={{ border: '1px solid #f3e8ff', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <b>{fmtDateTime(new Date(e.created_at))}</b>
                <span style={S.muted}>
                  by {e.edited_by_login || 'shop login'}
                  {e.authorized_name && <> · salesman change approved by <b>{e.authorized_name}</b></>}
                </span>
              </div>
              <div style={{ margin: '6px 0 8px', fontSize: 13 }}>Reason: <i>{e.reason}</i></div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {[...itemChanges(e), ...headerChanges(e)].map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
