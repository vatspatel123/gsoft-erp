import { supabase } from '../lib/supabase'

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
