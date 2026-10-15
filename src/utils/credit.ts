const n = (v: unknown) => Number(v) || 0

/**
 * What a customer still owes on ONE sale (their udhar): the part left unpaid when the bill was
 * made, minus anything collected since. A bill typed "credit" is often only partly credit
 * (₹14,000 UPI + ₹500 pending): using its whole net amount made every screen that read
 * payment_mode show the full bill as owed.
 * Bills saved before the payment split was recorded have no tender amounts; those are
 * taken as wholly credit when their type says credit.
 */
export function creditPendingOf(s: any): number {
  if (!s || s.is_return || s.credit_status === 'paid') return 0
  const recorded = [s.cash_amount, s.card_amount, s.upi_amount, s.credit_amount].some(v => n(v) > 0)
  const due = recorded ? n(s.credit_amount) : (s.payment_mode === 'credit' ? n(s.net_amount) : 0)
  return Math.max(0, Math.round((due - n(s.credit_paid)) * 100) / 100)
}
