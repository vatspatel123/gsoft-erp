export type Tenders = { cash: number; card: number; upi: number }

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The payment the shop actually KEEPS, from what the customer handed over.
 *
 * A customer paying ₹4,000 on a ₹3,700 bill is handed ₹300 back. The bill and
 * the books must say "Cash 3,700" — recording 4,000 counted the change as
 * income, and Cash Position then showed more money in the drawer than there
 * was. Any excess comes off cash first (change is given in cash), then UPI,
 * then card.
 */
export function appliedTenders(t: Tenders, net: number): Tenders {
  const out = { cash: r2(t.cash || 0), card: r2(t.card || 0), upi: r2(t.upi || 0) }
  let over = r2(out.cash + out.card + out.upi - (net || 0))
  for (const k of ['cash', 'upi', 'card'] as const) {
    if (over <= 0) break
    const take = Math.min(out[k], over)
    out[k] = r2(out[k] - take)
    over = r2(over - take)
  }
  return out
}
