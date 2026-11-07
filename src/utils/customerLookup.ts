import { supabase } from '../lib/supabase'

/** Gives up waiting after ms. The request itself carries on; only the screen stops waiting for it. */
export function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    work.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

/** What a customer has left on their credit notes, as printed on the bill. */
export type CreditLeft = { total: number; notes: { no: string; balance: number; expires_at?: string | null }[]; asOn?: string }

export function creditLeftFrom(notes: { credit_note_no: string; balance_amount: unknown; expires_at?: string | null }[]): CreditLeft | undefined {
  const left = notes
    .map(n => ({ no: n.credit_note_no, balance: Number(n.balance_amount) || 0, expires_at: n.expires_at }))
    .filter(n => n.balance > 0.004)
  if (!left.length) return undefined
  return { total: left.reduce((s, n) => s + n.balance, 0), notes: left }
}

/** The customer's credit balance today (for a reprint). Never holds up the bill: no answer in 3 seconds means no line. */
export async function creditLeftFor(customerId?: string | null, phone?: string | null): Promise<CreditLeft | undefined> {
  const who = [customerId && `customer_id.eq.${customerId}`, phone && `customer_phone.eq.${phone}`].filter(Boolean).join(',')
  if (!who) return undefined
  try {
    const { data } = await withTimeout(supabase.from('credit_notes')
      .select('credit_note_no, balance_amount, expires_at, created_at')
      .or(who).eq('status', 'active').gt('balance_amount', 0).order('created_at'), 3000)
    return creditLeftFrom((data || []).filter((n: any) => !n.expires_at || new Date(n.expires_at).getTime() > Date.now()))
  } catch { return undefined }
}

const digits = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10)

/** The customer already saved under this phone number, or null. */
export async function findCustomerByPhone(phone: unknown): Promise<any | null> {
  const p = digits(phone)
  if (p.length < 10) return null
  const { data } = await supabase.from('customers').select('*').ilike('phone', `%${p}`).limit(1)
  return data?.[0] ?? null
}

/**
 * The id of a customer that really exists in the database, for a customer a bill
 * points at. A customer made on this PC (offline, or a save the server refused) has
 * an id the database has never seen, and a sale pointing at it is refused — the bill
 * then sits in the offline queue and never reaches Invoices. So: use the same id if
 * the database has it, else the customer with the same phone, else make the customer.
 * Null (no customer on the bill) only if all of that fails: a bill without a customer
 * is better than a bill that cannot be saved.
 */
export async function resolveCustomerId(c: any): Promise<string | null> {
  if (!c) return null
  try {
    if (c.id) {
      const { data } = await supabase.from('customers').select('id').eq('id', c.id).maybeSingle()
      if (data) return data.id
    }
    const same = await findCustomerByPhone(c.phone)
    if (same) return same.id
    const phone = digits(c.phone)
    const { data, error } = await supabase.from('customers').insert({
      id: c.id || crypto.randomUUID(), name: c.name || 'Customer', phone: phone || null, email: c.email || null,
      date_of_birth: c.date_of_birth || null, loyalty_points: 0, total_spent: 0,
      referral_code: c.referral_code || Math.random().toString(36).slice(2, 10),
    }).select('id').single()
    if (!error && data) return data.id
    // Someone else saved the same phone in the meantime.
    return (await findCustomerByPhone(c.phone))?.id ?? null
  } catch { return null }
}
