import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface CashPosition {
  openingCash: number
  openingBank: number
  salesCash: number
  salesUpi: number
  salesCard: number
  udharCollectedCash: number
  udharCollectedBank: number
  supplierPaidCash: number
  supplierPaidBank: number
  expensesCash: number
  expensesBank: number
  cashOnHand: number
  bankOnHand: number
  // Money settled before tender tracking existed — deliberately excluded from the
  // figures above, and surfaced so the balance is explainable rather than silently off.
  untaggedSupplierPayments: number
}

const ZERO: CashPosition = {
  openingCash: 0, openingBank: 0,
  salesCash: 0, salesUpi: 0, salesCard: 0,
  udharCollectedCash: 0, udharCollectedBank: 0,
  supplierPaidCash: 0, supplierPaidBank: 0,
  expensesCash: 0, expensesBank: 0,
  cashOnHand: 0, bankOnHand: 0,
  untaggedSupplierPayments: 0
}

const isCash = (t?: string | null) => (t || '').toLowerCase() === 'cash'
const isDigital = (t?: string | null) => ['upi', 'bank', 'card', 'cheque'].includes((t || '').toLowerCase())

// Everything up to and including `asOf` (YYYY-MM-DD). Cash on hand is cumulative,
// not a per-day figure, so the date is an "as at" cut-off rather than a filter.
export function useCashPosition(asOf?: string) {
  const [position, setPosition] = useState<CashPosition>(ZERO)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cutoff = asOf || new Date().toISOString().slice(0, 10)
      const cutoffTs = cutoff + 'T23:59:59'

      const [store, sales, expenses, bills] = await Promise.all([
        // Ordered deterministically: a bare limit(1) can return the orphaned second
        // store, which would attach the float to a store holding none of the data.
        supabase.from('stores').select('id, opening_cash, opening_bank').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase
          .from('sales')
          .select('cash_amount, card_amount, upi_amount, credit_paid, credit_tender, is_return')
          .lte('created_at', cutoffTs),
        supabase.from('expenses').select('amount, payment_mode').lte('expense_date', cutoff),
        supabase.from('purchase_bills').select('amount_paid, payment_tender, payment_status')
      ])

      const p: CashPosition = { ...ZERO }
      p.openingCash = Number(store.data?.opening_cash || 0)
      p.openingBank = Number(store.data?.opening_bank || 0)
      setStoreId(store.data?.id || null)

      for (const s of sales.data || []) {
        if (s.is_return === true) continue
        p.salesCash += Number(s.cash_amount) || 0
        p.salesUpi += Number(s.upi_amount) || 0
        p.salesCard += Number(s.card_amount) || 0
        // Udhar later collected — counted against the tender it was collected in.
        const collected = Number(s.credit_paid) || 0
        if (collected > 0) {
          if (isCash(s.credit_tender)) p.udharCollectedCash += collected
          else if (isDigital(s.credit_tender)) p.udharCollectedBank += collected
        }
      }

      for (const e of expenses.data || []) {
        const amt = Number(e.amount) || 0
        if (isCash(e.payment_mode)) p.expensesCash += amt
        else p.expensesBank += amt
      }

      for (const b of bills.data || []) {
        const paid = Number(b.amount_paid) || 0
        if (paid <= 0) continue
        if (isCash(b.payment_tender)) p.supplierPaidCash += paid
        else if (isDigital(b.payment_tender)) p.supplierPaidBank += paid
        else p.untaggedSupplierPayments += paid
      }

      p.cashOnHand = p.openingCash + p.salesCash + p.udharCollectedCash - p.expensesCash - p.supplierPaidCash
      p.bankOnHand = p.openingBank + p.salesUpi + p.salesCard + p.udharCollectedBank - p.expensesBank - p.supplierPaidBank

      setPosition(p)
    } catch (e: any) {
      console.warn('Cash position notice:', e?.message || e)
    } finally {
      setLoading(false)
    }
  }, [asOf])

  useEffect(() => { load() }, [load])

  const saveOpeningFloat = async (cash: number, bank: number) => {
    if (!storeId) { toast.error('No store found to save the opening float against'); return false }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({ opening_cash: cash, opening_bank: bank })
        .eq('id', storeId)
      if (error) throw error
      toast.success('Opening balance saved')
      await load()
      return true
    } catch (e: any) {
      toast.error('Could not save opening balance: ' + (e.message || 'unknown error'))
      return false
    } finally {
      setSaving(false)
    }
  }

  return { position, loading, saving, saveOpeningFloat, refresh: load }
}
