import { supabase } from '../lib/supabase'

/**
 * HSN code for a product: the one typed on the product itself, else its category's.
 * Wholesale bills and e-way bills use this, so one code set per category fills every
 * product in it. Names are matched ignoring capitals, spaces and dashes, so
 * TOP / top and 3 pc / 3pc are the same category (and products named after their
 * category are found even without a category link).
 */
export const normName = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

let byId = new Map<string, string>()
let byName = new Map<string, string>()

/** Read the category codes (a few dozen rows). Safe to call often; failure keeps the last answer. */
export async function loadCategoryHsn(): Promise<void> {
  try {
    const { data, error } = await supabase.from('categories').select('id, name, hsn_code')
    if (error || !data) return
    const ids = new Map<string, string>(), names = new Map<string, string>()
    for (const c of data as any[]) {
      const code = String(c.hsn_code || '').trim()
      if (!code) continue
      ids.set(c.id, code)
      if (!names.has(normName(c.name))) names.set(normName(c.name), code)
    }
    byId = ids; byName = names
  } catch { /* keep what we had */ }
}

export const hsnOf = (product: any): string =>
  String(product?.hsn_code || '').trim()
  || byId.get(product?.category_id)
  || byName.get(normName(product?.name))
  || ''
