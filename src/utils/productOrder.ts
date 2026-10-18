import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SIZES } from './design'

// Smallest to largest: Free/One size, XS..XL, 2XL..10XL, then number sizes.
export function sizeRank(size: any): number {
  const s = String(size ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!s) return 9999
  if (s === 'FREESIZE' || s === 'ONESIZE') return 0
  const letters = ['XS', 'S', 'M', 'L', 'XL']
  if (letters.includes(s)) return 1 + letters.indexOf(s)
  const x = s.match(/^(\d+)XL/)                    // 2XL, 3XL-4XL -> by the first one
  if (x) return 10 + Number(x[1])
  const n = s.match(/^\d+/)
  if (n) return 100 + Number(n[0])
  return 5000
}

const KEYS = ['barcode', 'sku', 'design_no', 'pcode', 'batch_no']

/** Exact barcode/design/code match first, then "starts with", then "contains";
 *  inside that, same product together, then colour, then size small to large. */
export function sortProducts<T extends Record<string, any>>(list: T[], term = ''): T[] {
  const q = term.trim().toLowerCase()
  const score = (p: T) => {
    if (!q) return 0
    if (KEYS.some(k => p[k] != null && String(p[k]).trim().toLowerCase() === q)) return 0
    if (['design_no', 'name', 'sku', 'barcode'].some(k => p[k] != null && String(p[k]).toLowerCase().startsWith(q))) return 1
    return 2
  }
  const t = (v: any) => String(v ?? '').toLowerCase()
  return [...list].sort((a, b) =>
    score(a) - score(b) ||
    t(a.name).localeCompare(t(b.name)) ||
    t(a.design_no).localeCompare(t(b.design_no), undefined, { numeric: true }) ||
    t(a.colour).localeCompare(t(b.colour)) ||
    sizeRank(a.size) - sizeRank(b.size)
  )
}

/** Standard sizes plus every size ever saved on a product (so a new size typed
 *  once shows in the list from then on). */
export function useSizes(): string[] {
  const [used, setUsed] = useState<string[]>([])
  useEffect(() => {
    supabase.from('products').select('size').not('size', 'is', null).limit(5000)
      .then(({ data }) => setUsed(Array.from(new Set((data || []).map((r: any) => String(r.size).trim()).filter(Boolean)))))
  }, [])
  const base = SIZES.filter(s => s !== 'Custom')
  return Array.from(new Set([...base, 'One Size', ...used])).sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
}
