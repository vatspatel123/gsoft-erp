import { supabase } from '../lib/supabase'
import { appliedTenders } from './tenders'
import { refreshProductsInCache } from './offlineCache'

/**
 * Editing bills after they're made.
 *
 * The edit itself happens in the database (edit_sale / edit_purchase in
 * BILL_EDITS_SCHEMA.sql) as one transaction, so stock, udhar, loyalty and the
 * bill can never end up half-changed. These helpers only call it and preview
 * the totals with the same formulas the POS and Purchase Entry use.
 */

export interface SaleLine {
  product_id: string
  name: string
  barcode?: string
  size?: string
  qty: number
  unit_price: number
  discount_pct: number
  gst_rate: number
  /** What was on the bill before this edit (0 for an added line). */
  orig_qty: number
  /** Stock on the shelf right now, before this edit. */
  stock_qty: number
}

export interface PurchaseLine {
  product_id: string            // '' for a new product added on the edit screen
  key?: string
  name: string
  barcode?: string
  size?: string
  design_no?: string
  colour?: string
  mrp?: number
  wholesale_price?: number
  online_price?: number
  pcode?: string
  qty: number
  unit_cost: number
  gst_rate: number
  orig_qty: number
  stock_qty: number
}

export interface BillEdit {
  id: string
  bill_type: 'sale' | 'purchase'
  bill_no: string | null
  reason: string
  authorized_name: string | null
  edited_by_login: string | null
  before: { bill: any; items: any[] }
  after: { bill: any; items: any[] }
  created_at: string
}

// ── the same arithmetic the POS uses: prices include GST ─────────────────────
export const saleLineTotal = (l: Pick<SaleLine, 'unit_price' | 'qty' | 'discount_pct'>) =>
  Math.round(l.unit_price * l.qty * (1 - (l.discount_pct || 0) / 100) * 100) / 100

export function saleTotals(lines: SaleLine[], discount: number, tenders: { cash: number; card: number; upi: number }, shipping = 0) {
  const subtotal = lines.reduce((s, l) => s + saleLineTotal(l), 0)
  const gst = lines.reduce((s, l) => {
    const t = saleLineTotal(l), r = (l.gst_rate || 0) / 100
    return s + (r > 0 ? t - t / (1 + r) : 0)
  }, 0)
  const disc = Math.min(Math.max(0, discount || 0), subtotal)
  const ship = Math.max(0, Number(shipping) || 0)   // charged on top, no GST (see edit_sale)
  const net = Math.round((subtotal - disc + ship) * 100) / 100
  const handed = (tenders.cash || 0) + (tenders.card || 0) + (tenders.upi || 0)
  const kept = appliedTenders(tenders, net)
  const paid = kept.cash + kept.card + kept.upi
  const udhar = Math.max(0, Math.round((net - paid) * 100) / 100)
  const change = Math.max(0, Math.round((handed - net) * 100) / 100)
  return { subtotal, gst, discount: disc, shipping: ship, net, paid, udhar, change, kept }
}

// ── the same arithmetic Purchase Entry uses: GST added on top ────────────────
export function purchaseTotals(lines: PurchaseLine[], discount: number, freight: number) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0)
  // GST is on the value after the supplier's discount (same as Purchase Entry and edit_purchase).
  const disc = Math.min(subtotal, Math.max(0, discount || 0))
  const share = subtotal > 0 ? (subtotal - disc) / subtotal : 0
  const gst = lines.reduce((s, l) => s + l.qty * l.unit_cost * (l.gst_rate || 0) / 100, 0) * share
  const pre = subtotal - disc + Math.max(0, freight || 0) + gst
  const net = Math.round(pre)
  return { subtotal, gst, net, roundOff: Math.round((net - pre) * 100) / 100 }
}

/**
 * What the billing screen sends when a saved bill is edited there (the same edit_sale call the old
 * edit window made). The totals use the database's own arithmetic (saleTotals), so what is saved is
 * exactly what the database works out.
 */
export function billEditPayload(a: {
  cart: { product: { id: string; name: string; gst_rate?: number }; qty: number; unit_price: number; discount_pct: number }[]
  origQty: Record<string, number>
  discount: number; shipping: number
  tenders: { cash: number; card: number; upi: number }
  /** What the billing screen itself shows as still to be paid. */
  screenPending: number
  note: string; alteration: number
  customerId: string; origCustomerId: string
  salesmanId: string; origSalesmanId: string
}) {
  const lines: SaleLine[] = a.cart.map(i => ({
    product_id: i.product.id, name: i.product.name, qty: i.qty, unit_price: i.unit_price, discount_pct: i.discount_pct,
    gst_rate: Number(i.product.gst_rate) || 0, orig_qty: a.origQty[i.product.id] || 0, stock_qty: 0,
  }))
  const discount = Math.round((a.discount || 0) * 100) / 100
  const t = saleTotals(lines, discount, a.tenders, a.shipping)
  // The screen adds item amounts unrounded, the database rounds each line. When the screen says "fully paid"
  // but the database finds a few paise left, put those paise on the biggest payment so the bill does not
  // turn into a pending one over a rounding difference.
  let kept = { ...t.kept }
  if (a.screenPending <= 0.009 && t.udhar > 0 && t.udhar < 0.05) {
    const big = (['cash', 'upi', 'card'] as const).reduce((m, k) => (kept[k] > kept[m] ? k : m), 'cash' as 'cash' | 'upi' | 'card')
    kept = { ...kept, [big]: Math.round((kept[big] + t.udhar) * 100) / 100 }
  }
  const changes: Record<string, unknown> = {
    discount_amount: discount,
    cash_amount: kept.cash, card_amount: kept.card, upi_amount: kept.upi,
    note: a.note.trim(), alteration_qty: a.alteration, shipping_amount: a.shipping,
  }
  if (a.customerId !== a.origCustomerId) changes.customer_id = a.customerId
  const salesmanChanged = a.salesmanId !== a.origSalesmanId
  if (salesmanChanged) changes.salesman_id = a.salesmanId
  return { lines, changes, salesmanChanged, net: t.net }
}

/** Postgres error text, without the transport noise around it. */
const clean = (e: any): string =>
  String(e?.message || e || 'Something went wrong').replace(/^.*?ERROR:\s*/i, '').trim()

export async function editSale(
  saleId: string,
  changes: Record<string, unknown>,
  lines: SaleLine[],
  reason: string,
  auth?: { login: string; password: string },
): Promise<{ ok: true; net: number; udhar: number } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('edit_sale', {
    p_sale_id: saleId,
    p_changes: changes,
    p_items: lines.map(l => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_price, discount_pct: l.discount_pct })),
    p_reason: reason,
    p_auth_login: auth?.login ?? null,
    p_auth_password: auth?.password ?? null,
  })
  if (error) return { ok: false, error: clean(error) }
  void refreshProductsInCache(lines.map(l => l.product_id))   // stock moved: the billing screen sees it at once
  return { ok: true, net: Number(data?.net_amount), udhar: Number(data?.udhar) }
}

export async function editPurchase(
  billId: string,
  changes: Record<string, unknown>,
  lines: PurchaseLine[],
  reason: string,
): Promise<{ ok: true; net: number; roundOff: number } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('edit_purchase', {
    p_bill_id: billId,
    p_changes: changes,
    p_items: lines.map(l => ({
      product_id: l.product_id || null, product_name: l.name, design_no: l.design_no ?? '', pcode: l.pcode ?? '',
      size: l.size ?? '', colour: l.colour ?? '', barcode: l.barcode ?? '',
      qty: l.qty, unit_cost: l.unit_cost, gst_rate: l.gst_rate, mrp: l.mrp ?? null,
      wholesale_price: l.wholesale_price ?? '', online_price: l.online_price ?? '',
    })),
    p_reason: reason,
  })
  if (error) return { ok: false, error: clean(error) }
  void refreshProductsInCache(lines.map(l => l.product_id), lines.filter(l => !l.product_id).map(l => String(l.barcode || '')))   // new pieces and new stock: the billing screen sees them at once
  return { ok: true, net: Number(data?.net_amount), roundOff: Number(data?.round_off) }
}

export interface WholesaleLine {
  product_id: string
  name: string
  barcode?: string
  size?: string
  qty: number
  unit_price: number
  mrp: number
  discount_pct: number
  gst_rate: number
  orig_qty: number
  stock_qty: number
}

// ── the same arithmetic the Wholesale screen uses: GST added on top ──────────
export const wholesaleLineTaxable = (l: Pick<WholesaleLine, 'qty' | 'unit_price' | 'discount_pct'>) =>
  l.qty * l.unit_price * (1 - (l.discount_pct || 0) / 100)

export function wholesaleTotals(lines: WholesaleLine[], discountPct: number, freight: number) {
  const subtotal = lines.reduce((s, l) => s + wholesaleLineTaxable(l), 0)
  const billDisc = subtotal * (discountPct || 0) / 100
  const gst = lines.reduce((s, l) => s + wholesaleLineTaxable(l) * (l.gst_rate || 0) / 100, 0) * (1 - (discountPct || 0) / 100)
  const raw = subtotal - billDisc + gst + Math.max(0, freight || 0)
  const net = Math.round(raw)
  return { subtotal, billDisc, gst, net, roundOff: Math.round((net - raw) * 100) / 100 }
}

export async function editWholesale(
  billId: string,
  changes: Record<string, unknown>,
  lines: WholesaleLine[],
  reason: string,
): Promise<{ ok: true; net: number } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('edit_wholesale', {
    p_id: billId,
    p_changes: changes,
    p_items: lines.map(l => ({
      product_id: l.product_id, qty: l.qty, unit_price: l.unit_price, mrp: l.mrp,
      discount_pct: l.discount_pct, gst_rate: l.gst_rate,
    })),
    p_reason: reason,
  })
  if (error) return { ok: false, error: clean(error) }
  void refreshProductsInCache(lines.map((l: any) => l.product_id))   // stock moved: the billing screen sees it at once
  return { ok: true, net: Number(data?.net_amount) }
}

export async function billHistory(type: 'sale' | 'purchase', billId: string): Promise<BillEdit[]> {
  const { data } = await supabase
    .from('bill_edits')
    .select('*')
    .eq('bill_type', type)
    .eq('bill_id', billId)
    .order('created_at', { ascending: false })
  return (data as BillEdit[]) || []
}

// ── staff passwords ──────────────────────────────────────────────────────────
export async function setStaffPassword(
  userId: string, password: string, owner?: { login: string; password: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('set_staff_password', {
    p_user_id: userId,
    p_new_password: password,
    p_owner_login: owner?.login ?? null,
    p_owner_password: owner?.password ?? null,
  })
  return error ? { ok: false, error: clean(error) } : { ok: true }
}

/** Ids of staff who have a password set. Empty if the feature isn't installed yet. */
export async function staffWithPassword(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('staff_with_password')
  if (error || !Array.isArray(data)) return new Set()
  return new Set(data.map((r: any) => (typeof r === 'string' ? r : r?.staff_with_password)).filter(Boolean))
}

export const money = (n: number) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Delete a bill for good. Needs the admin's login password; stock is put back. */
export async function deleteBill(
  type: 'sale' | 'purchase' | 'exchange', billId: string, reason: string, password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = type === 'sale'
    ? await supabase.rpc('delete_sale', { p_sale_id: billId, p_reason: reason, p_admin_password: password })
    : type === 'exchange'
      ? await supabase.rpc('delete_exchange', { p_exchange_id: billId, p_reason: reason, p_admin_password: password })
      : await supabase.rpc('delete_purchase', { p_bill_id: billId, p_reason: reason, p_admin_password: password })
  return error ? { ok: false, error: clean(error) } : { ok: true }
}
