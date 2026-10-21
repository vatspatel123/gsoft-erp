import { supabase } from '../lib/supabase'

/**
 * One dated row per payment of an old pending (udhar) amount, so the Day Book and the
 * Reports show that money on the day it was received (CUSTOMER_PAYMENTS.sql).
 * Never blocks or fails the payment itself: the running total on the bill is the
 * source of truth for what is owed, this row is only the date.
 */
export async function recordDuePayment(p: {
  sale_id?: string | null; exchange_id?: string | null; customer_id?: string | null; amount: number; tender: string
}) {
  try {
    const { error } = await supabase.from('customer_payments').insert({
      sale_id: p.sale_id || null, exchange_id: p.exchange_id || null, customer_id: p.customer_id || null,
      amount: Math.round(p.amount * 100) / 100, tender: (p.tender || 'cash').toLowerCase(),
    })
    if (error) console.warn('Due payment date not recorded:', error.message)
  } catch (e) { console.warn('Due payment date not recorded:', e) }
}
