const CACHE_KEY = 'gsoft_products_cache'
const CACHE_TTL_MS = 30 * 60 * 1000

export const CACHE_KEYS = {
  products: 'gsoft_products_cache',
  salesmen: 'gsoft_salesmen_cache',
  customers: 'gsoft_customers_cache',
  pendingSales: 'gsoft_pending_sales',
}

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  unit_price: number
  gst_rate: number
  stock_qty: number
  low_stock_alert: number
  photo_url: string | null
  is_active: boolean
  created_at?: string | null
  design_no?: string
  pcode?: string | null
  size?: string | null
  colour?: string | null
  mrp?: number | null
  batch_no?: string | null
}

interface CacheEntry {
  products: Product[]
  savedAt: number
}

// ── Products Cache ──────────────────────
export function saveProductsToCache(
  products: Product[],
  opts: { replace?: boolean } = {}
): void {
  try {
    // `replace` means "this IS the whole catalogue" — anything absent from it has
    // been deleted and must leave the cache too. Merging unconditionally (the old
    // behaviour) kept deleted products alive in the browser forever: they kept
    // appearing in lists, in low-stock alerts, and as barcode-scan candidates
    // long after they were gone from the database.
    const existing = opts.replace ? [] : (getCachedProducts() || [])
    const map = new Map<string, Product>()
    for (const p of existing) map.set(p.id, p)
    for (const p of products) map.set(p.id, p)
    const entry: CacheEntry = {
      products: Array.from(map.values()),
      savedAt: Date.now()
    }
    localStorage.setItem(
      CACHE_KEY, JSON.stringify(entry)
    )
  } catch {}
}

export function getCachedProducts(): 
  Product[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    return entry.products || []
  } catch { return null }
}

export function searchCachedProducts(
  query: string, limit = 12
): Product[] {
  const products = getCachedProducts()
  if (!products || !query.trim()) return []
  const q = query.trim().toLowerCase()
  return products
    .filter(p =>
      p.is_active !== false && (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.design_no && p.design_no.toLowerCase().includes(q)) ||
        (p.batch_no && p.batch_no.toLowerCase().includes(q)) ||
        (p.pcode && p.pcode.toLowerCase().includes(q)) ||
        ((p as any).categories?.name && (p as any).categories.name.toLowerCase().includes(q))
      )
    ).slice(0, limit)
}

export function isCacheValid(): boolean {
  return getCachedProducts() !== null
}

export function clearProductCache(): void {
  localStorage.removeItem(CACHE_KEY)
}

export function getCacheAge(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { savedAt } = JSON.parse(raw) as CacheEntry
    const mins = Math.floor(
      (Date.now() - savedAt) / 60000
    )
    return mins < 1 ? 'just now' : `${mins}m ago`
  } catch { return null }
}

// ── Salesmen Cache ──────────────────────
export function saveSalesmenToCache(
  salesmen: any[]
): void {
  try {
    localStorage.setItem(
      CACHE_KEYS.salesmen,
      JSON.stringify({
        data: salesmen,
        savedAt: Date.now()
      })
    )
  } catch {}
}

export function getCachedSalesmen(): 
  any[] | null {
  try {
    const raw = localStorage.getItem(
      CACHE_KEYS.salesmen
    )
    if (!raw) return null
    return JSON.parse(raw).data
  } catch { return null }
}

/** A salesman's name from this PC's saved staff list (works offline). */
export function salesmanNameFor(id: string | null | undefined): string | null {
  if (!id) return null
  return (getCachedSalesmen() || []).find((s: any) => s.id === id)?.name ?? null
}

// ── Customers Cache ─────────────────────
export function saveCustomerToCache(
  customer: any
): void {
  try {
    const existing = getCachedCustomers() || []
    const updated = existing.filter(
      (c: any) => c.phone !== customer.phone
    )
    updated.push(customer)
    localStorage.setItem(
      CACHE_KEYS.customers,
      JSON.stringify({
        data: updated,
        savedAt: Date.now()
      })
    )
  } catch {}
}

export function saveCustomersToCache(
  customers: any[]
): void {
  try {
    localStorage.setItem(
      CACHE_KEYS.customers,
      JSON.stringify({
        data: customers,
        savedAt: Date.now()
      })
    )
  } catch {}
}

export function getCachedCustomers(): 
  any[] | null {
  try {
    const raw = localStorage.getItem(
      CACHE_KEYS.customers
    )
    if (!raw) return null
    return JSON.parse(raw).data
  } catch { return null }
}

export function findCachedCustomer(
  phone: string
): any | null {
  const customers = getCachedCustomers()
  if (!customers) return null
  return customers.find(
    (c: any) => c.phone === phone
  ) || null
}

// ── Pending Sales (Offline Bills) ───────
export function savePendingSale(
  saleData: any
): void {
  const pending = getPendingSales()
  pending.push({
    ...saleData,
    pendingId: Date.now(),
    createdAt: new Date().toISOString()
  })
  try {
    localStorage.setItem(
      CACHE_KEYS.pendingSales,
      JSON.stringify(pending)
    )
  } catch {}
}

/**
 * Put recovered bills back into the queue of bills waiting for the server (see
 * tools/find-lost-bills.js). Skips a bill already in the queue; keeps every pendingId unique.
 */
export function addPendingBills(bills: any[]): { added: number; skipped: number } {
  const pending = getPendingSales()
  let added = 0, skipped = 0
  for (const b of bills) {
    if (!b || !b.invoiceNo || !Array.isArray(b.cart) || !b.cart.length || pending.some((p: any) => p.invoiceNo === b.invoiceNo)) { skipped++; continue }
    let id = Number(b.pendingId) || Date.now()
    while (pending.some((p: any) => p.pendingId === id)) id++
    pending.push({ ...b, pendingId: id, createdAt: b.createdAt || new Date().toISOString() })
    added++
  }
  try { localStorage.setItem(CACHE_KEYS.pendingSales, JSON.stringify(pending)) } catch { return { added: 0, skipped: bills.length } }
  return { added, skipped }
}

/** How long a bill being re-made in POS is kept out of the automatic sending. */
export const HOLD_MS = 30 * 60 * 1000
export const isHeld = (s: any) => !!s?.heldAt && Date.now() - s.heldAt < HOLD_MS

/**
 * Put an unsent bill aside while it is re-made in POS (so the automatic sending does not also send
 * the old copy), or release it. A forgotten hold expires on its own after HOLD_MS.
 */
export function holdPendingSale(pendingId: number, on: boolean): void {
  const updated = getPendingSales().map((s: any) => {
    if (s.pendingId !== pendingId) return s
    const { heldAt: _h, ...rest } = s
    return on ? { ...rest, heldAt: Date.now() } : rest
  })
  try { localStorage.setItem(CACHE_KEYS.pendingSales, JSON.stringify(updated)) } catch { /* not kept */ }
}

export function getPendingSales(): any[] {
  try {
    const raw = localStorage.getItem(
      CACHE_KEYS.pendingSales
    )
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

export function clearPendingSale(
  pendingId: number
): void {
  const updated = getPendingSales().filter(
    (s: any) => s.pendingId !== pendingId
  )
  try {
    localStorage.setItem(
      CACHE_KEYS.pendingSales,
      JSON.stringify(updated)
    )
  } catch {}
}

export function getPendingCount(): number {
  return getPendingSales().length
}