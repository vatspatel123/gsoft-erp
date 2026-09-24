import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface PayableRow {
  id: string
  purchase_no: string
  supplier_id: string | null
  net_amount: number
  amount_paid: number
  payment_status: string
  created_at: string
  supplier_invoice_no: string | null
  suppliers?: { id: string; name: string; phone: string | null } | null
}

// Outstanding is always derived, never stored, so a part-payment cannot drift
// out of sync with the bill's status.
export const payableOutstanding = (p: PayableRow) =>
  Math.max(0, Number(p.net_amount || 0) - Number(p.amount_paid || 0))

export const receivableOutstanding = (r: { credit_amount: number; credit_paid: number }) =>
  Math.max(0, Number(r.credit_amount || 0) - Number(r.credit_paid || 0))

export interface ReceivableRow {
  id: string
  invoice_no: string
  customer_id: string | null
  net_amount: number
  credit_amount: number
  credit_paid: number
  credit_status: string
  credit_due_date: string | null
  created_at: string
  customers?: { id: string; name: string; phone: string | null } | null
}

export interface CreditNoteRow {
  id: string
  credit_note_no: string
  customer_name: string | null
  customer_phone: string | null
  balance_amount: number
  created_at: string
}

export interface DayBookRow {
  date: string
  cashIn: number
  upiIn: number
  cardIn: number
  creditGiven: number
  cashOut: number
  digitalOut: number
  net: number
}

const daysOld = (iso: string | null) => {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

// Standard ageing buckets used by both payables and receivables.
export const bucketOf = (days: number): '0-30' | '31-60' | '60+' =>
  days <= 30 ? '0-30' : days <= 60 ? '31-60' : '60+'

export function useAccounts() {
  const [payables, setPayables] = useState<PayableRow[]>([])
  const [receivables, setReceivables] = useState<ReceivableRow[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([])
  const [dayBook, setDayBook] = useState<DayBookRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const since = new Date(Date.now() - 60 * 86400000).toISOString()

      const [pay, rec, cn, sales, exp] = await Promise.all([
        // Payables: anything not settled with a supplier.
        supabase
          .from('purchase_bills')
          .select('id, purchase_no, supplier_id, net_amount, amount_paid, payment_status, created_at, supplier_invoice_no, suppliers(id, name, phone)')
          .neq('payment_status', 'paid')
          .order('created_at', { ascending: true }),

        // Receivables: udhar still outstanding. credit_amount covers split bills too,
        // where only part of the bill was left unpaid.
        supabase
          .from('sales')
          .select('id, invoice_no, customer_id, net_amount, credit_amount, credit_paid, credit_status, credit_due_date, created_at, customers(id, name, phone)')
          .neq('credit_status', 'paid')
          .gt('credit_amount', 0)
          .order('created_at', { ascending: true }),

        // Outstanding store credit is a liability to the customer.
        supabase
          .from('credit_notes')
          .select('id, credit_note_no, customer_name, customer_phone, balance_amount, created_at')
          .eq('status', 'active')
          .gt('balance_amount', 0),

        // Day book money-in comes from the tender columns, not payment_mode, so a
        // split bill contributes to each tender it actually used.
        supabase
          .from('sales')
          .select('created_at, cash_amount, card_amount, upi_amount, credit_amount, is_return')
          .gte('created_at', since),

        supabase
          .from('expenses')
          .select('expense_date, amount, payment_mode')
          .gte('expense_date', since.slice(0, 10))
      ])

      if (!pay.error) setPayables((pay.data || []) as any)
      if (!rec.error) setReceivables((rec.data || []) as any)
      if (!cn.error) setCreditNotes((cn.data || []) as any)

      const byDay = new Map<string, DayBookRow>()
      const row = (date: string) => {
        if (!byDay.has(date)) {
          byDay.set(date, { date, cashIn: 0, upiIn: 0, cardIn: 0, creditGiven: 0, cashOut: 0, digitalOut: 0, net: 0 })
        }
        return byDay.get(date)!
      }

      for (const s of sales.data || []) {
        if (s.is_return === true) continue
        const r = row(String(s.created_at).slice(0, 10))
        r.cashIn += Number(s.cash_amount) || 0
        r.upiIn += Number(s.upi_amount) || 0
        r.cardIn += Number(s.card_amount) || 0
        r.creditGiven += Number(s.credit_amount) || 0
      }

      for (const e of exp.data || []) {
        const r = row(String(e.expense_date).slice(0, 10))
        if (e.payment_mode === 'cash') r.cashOut += Number(e.amount) || 0
        else r.digitalOut += Number(e.amount) || 0
      }

      const days = Array.from(byDay.values()).map(r => ({
        ...r,
        net: r.cashIn + r.upiIn + r.cardIn - r.cashOut - r.digitalOut
      })).sort((a, b) => b.date.localeCompare(a.date))

      setDayBook(days)
    } catch (e: any) {
      console.warn('Accounts load notice:', e?.message || e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Part-payments accumulate into amount_paid; the bill only flips to 'paid' once
  // the running total covers it. payment_status is deliberately left as
  // pending/paid — see PARTIAL_SETTLEMENT_SCHEMA.sql for why.
  // tender is recorded so cash-on-hand knows whether the money physically left
  // the drawer or the bank. Without it the cash position would silently overstate.
  const settlePayable = async (row: PayableRow, amount: number, tender: string = 'cash') => {
    const pay = Math.max(0, Math.min(amount, payableOutstanding(row)))
    if (pay <= 0) { toast.error('Enter an amount greater than zero'); return false }
    const newPaid = Number(row.amount_paid || 0) + pay
    const settled = newPaid >= Number(row.net_amount || 0) - 0.009
    try {
      const { error } = await supabase
        .from('purchase_bills')
        .update({ amount_paid: newPaid, payment_tender: tender, ...(settled ? { payment_status: 'paid' } : {}) })
        .eq('id', row.id)
      if (error) throw error
      setPayables(prev => settled
        ? prev.filter(p => p.id !== row.id)
        : prev.map(p => p.id === row.id ? { ...p, amount_paid: newPaid } : p))
      toast.success(settled ? 'Supplier bill fully settled' : `Part payment of ₹${pay.toFixed(2)} recorded`)
      return true
    } catch (e: any) {
      toast.error('Could not record payment: ' + (e.message || 'unknown error'))
      return false
    }
  }

  const settleReceivable = async (row: ReceivableRow, amount: number, tender: string = 'cash') => {
    const pay = Math.max(0, Math.min(amount, receivableOutstanding(row)))
    if (pay <= 0) { toast.error('Enter an amount greater than zero'); return false }
    const newPaid = Number(row.credit_paid || 0) + pay
    const settled = newPaid >= Number(row.credit_amount || 0) - 0.009
    try {
      const { error } = await supabase
        .from('sales')
        .update({ credit_paid: newPaid, credit_tender: tender, credit_status: settled ? 'paid' : 'partial' })
        .eq('id', row.id)
      if (error) throw error
      setReceivables(prev => settled
        ? prev.filter(r => r.id !== row.id)
        : prev.map(r => r.id === row.id ? { ...r, credit_paid: newPaid, credit_status: 'partial' } : r))
      toast.success(settled ? 'Udhar fully cleared' : `Part payment of ₹${pay.toFixed(2)} recorded`)
      return true
    } catch (e: any) {
      toast.error('Could not record payment: ' + (e.message || 'unknown error'))
      return false
    }
  }

  const ageing = <T,>(rows: T[], amount: (r: T) => number, dateOf: (r: T) => string | null) => {
    const out = { '0-30': 0, '31-60': 0, '60+': 0 }
    for (const r of rows) out[bucketOf(daysOld(dateOf(r)))] += amount(r)
    return out
  }

  const payableTotal = payables.reduce((s, p) => s + payableOutstanding(p), 0)
  const receivableTotal = receivables.reduce((s, r) => s + receivableOutstanding(r), 0)
  const creditNoteTotal = creditNotes.reduce((s, c) => s + Number(c.balance_amount || 0), 0)

  const today = new Date().toISOString().slice(0, 10)
  const todayRow = dayBook.find(d => d.date === today)

  return {
    loading,
    payables, receivables, creditNotes, dayBook,
    payableTotal, receivableTotal, creditNoteTotal,
    payableAgeing: ageing(payables, payableOutstanding, p => p.created_at),
    receivableAgeing: ageing(receivables, receivableOutstanding, r => r.created_at),
    overdueReceivables: receivables.filter(r => r.credit_due_date && r.credit_due_date < today),
    todayCashIn: todayRow?.cashIn || 0,
    todayCashOut: todayRow?.cashOut || 0,
    todayNet: todayRow?.net || 0,
    daysOld,
    settlePayable, settleReceivable,
    refresh: load
  }
}
