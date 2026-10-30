import { useState, useEffect, useRef } from 'react'
import { writeLocal, seedLocal } from '../utils/localStore'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { getPendingSales, salesmanNameFor } from '../utils/offlineCache'
import { useLiveRefresh } from './useLiveRefresh'

export interface Invoice {
  id: string
  invoice_no: string
  customer_id?: string
  salesman_id?: string
  counter_id?: string
  total_amount: number
  discount_amount: number
  net_amount: number
  gst_amount: number
  payment_mode: 'cash' | 'card' | 'upi' | 'credit'
  cash_amount?: number
  card_amount?: number
  upi_amount?: number
  credit_amount?: number
  credit_paid?: number
  credit_status?: string
  note?: string | null
  alteration_qty?: number
  shipping_amount?: number
  credit_due_date?: string
  credit_due_days?: number
  is_return: boolean
  created_at: string
  edit_count?: number
  /** A bill that only exists on this PC (not on the server yet): its queue id. */
  pendingId?: number
  _pending?: boolean
  customers?: {
    name: string
    phone: string
  } | null
  users?: {
    name: string
  } | null
  sale_items?: Array<{
    id: string
    qty: number
    unit_price: number
    discount_pct: number
    line_total: number
    gst_rate: number
    products?: {
      id: string
      name: string
      gst_rate: number
      design_no?: string
      size?: string
      colour?: string
      barcode?: string
      categories?: { name: string } | null
    } | null
  }> | null
}

export interface Salesman {
  id: string
  name: string
}

/** An exchange, shown in the Sales & Invoices list beside the bills. Managed on the Exchange page. */
export interface ExchangeRow {
  id: string; exchange_no: string; original_invoice_no: string | null; original_sale_id?: string | null; created_at: string
  /** Salesman of the original bill (exchanges have no salesman of their own yet). */
  salesman_name?: string | null
  /** True when salesman_name is who MADE the exchange (not just the original bill's salesman). */
  salesman_made_it?: boolean
  return_amount: number; new_sale_amount: number; balance_amount: number
  balance_type: 'nil' | 'customer_pays' | 'store_credit'
  cash_amount: number; card_amount: number; upi_amount: number; credit_amount: number
  customers: { name: string; phone: string } | null
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [salesmanFilter, setSalesmanFilter] = useState('all')
  const [dateRange, setDateRange] = useState('month')
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const [customFrom, setCustomFrom] = useState(todayStr)
  const [customTo, setCustomTo] = useState(todayStr)
  const [salesmen, setSalesmen] = useState<Salesman[]>([])

  // Day boundaries in the shop's own time (this PC's clock), not UTC. The list
  // opens on This Month: opening on Today hid yesterday's bills, which looked
  // like they had been lost.
  const getDateFilter = (): { from: string | null; to: string | null } => {
    const now = new Date()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const tomorrow = new Date(startOfDay(now).getTime() + 86400000).toISOString()
    if (dateRange === 'all') return { from: null, to: null }
    if (dateRange === 'custom') {
      // First day 00:00 to the end of the last day, as the shop's own days (local time).
      const [fy, fm, fd] = (customFrom || todayStr).split('-').map(Number)
      const [ty, tm, td] = (customTo || customFrom || todayStr).split('-').map(Number)
      return { from: new Date(fy, fm - 1, fd).toISOString(), to: new Date(ty, tm - 1, td + 1).toISOString() }
    }
    if (dateRange === 'week') return { from: new Date(startOfDay(now).getTime() - 6 * 86400000).toISOString(), to: tomorrow }
    if (dateRange === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: tomorrow }
    return { from: startOfDay(now).toISOString(), to: tomorrow }
  }

  const fresh = useRef(false)   // the server has answered; the PC's copy is older
  const shown = useRef(false)   // bills are on screen: refresh quietly, no spinner
  const latest = useRef(0)    // only the newest load may fill the screen
  const fetchInvoices = async () => {
    const mine = ++latest.current
    if (!shown.current) setLoading(true)
    const { from, to } = getDateFilter()
    let fetchedInvoices: Invoice[] = []

    try {
      if (navigator.onLine) {
        let query = supabase
          .from('sales')
          .select(
            `*,
            customers(name, phone),
            users(name),
            sale_items(
              id, qty, unit_price,
              discount_pct, line_total, gst_rate,
              products(id, name, gst_rate, design_no, size, colour, barcode, categories(name))
            )`
          )
          .order('created_at', { ascending: false })

        if (paymentFilter === 'credit_overdue_15') {
          const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          // Overdue = still owing: a bill the customer has settled is not overdue.
          query = query.eq('payment_mode', 'credit').lte('created_at', fifteenDaysAgo).or('credit_status.is.null,credit_status.neq.paid')
        } else {
          if (from) query = query.gte('created_at', from)
          if (to) query = query.lt('created_at', to)

          if (paymentFilter !== 'all') {
            // By the money actually taken in that mode, as Reports counts it: a bill paid part UPI,
            // part credit has payment_mode 'credit' but still belongs under UPI. (Bills saved before
            // the split was recorded have no amounts: those still match by payment_mode.)
            query = query.or(`${paymentFilter}_amount.gt.0,payment_mode.eq.${paymentFilter}`)
          }
        }

        if (salesmanFilter !== 'all') {
          query = query.eq('salesman_id', salesmanFilter)
        }

        const { data, error } = await query
        if (!error && data) {
          fetchedInvoices = data as Invoice[]
        }
      }
    } catch (e) {
      console.warn('Network invoice query error, using local sales:', e)
    }

    // Merge pending/offline sales from local cache
    const pending = getPendingSales() || []
    const pendingMapped: Invoice[] = pending.map((p: any) => ({
      _pending: true,
      pendingId: p.pendingId,
      id: p.saleId || 'local-' + p.pendingId,
      invoice_no: p.invoiceNo || 'INV-LOCAL',
      customer_id: p.customer?.id,
      salesman_id: p.salesmanId,
      counter_id: p.counterId,
      total_amount: p.subtotal || p.total_amount || 0,
      discount_amount: p.totalDiscount || p.discount_amount || 0,
      net_amount: p.netAmount || p.net_amount || 0,
      gst_amount: p.gstAmount || p.gst_amount || 0,
      payment_mode: p.paymentMode || p.payment_mode || 'cash',
      // How it was paid, so unsent bills are counted by their real split like the others.
      cash_amount: p.tenders?.cash, card_amount: p.tenders?.card, upi_amount: p.tenders?.upi, credit_amount: p.creditRemainder,
      note: p.note, alteration_qty: p.alterationQty, shipping_amount: p.shipping,
      is_return: false,
      created_at: p.createdAt || p.date || new Date().toISOString(),
      customers: p.customer ? { name: p.customer.name, phone: p.customer.phone } : null,
      // Bills queued by an older version kept only the salesman's id: look the name up.
      users: (p.salesmanName || salesmanNameFor(p.salesmanId)) ? { name: p.salesmanName || salesmanNameFor(p.salesmanId) } : null,
      sale_items: p.cart?.map((item: any, idx: number) => ({
        id: 'item-' + idx,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct || 0,
        line_total: item.line_total,
        gst_rate: item.product?.gst_rate || 0,
        products: {
          id: item.product?.id || 'p-id',
          name: item.product?.name || 'Product',
          gst_rate: item.product?.gst_rate || 0,
          // The unsent bill kept the whole product: show it (design, size, colour, barcode, category)
          // so the bill can be checked, printed and re-made properly.
          design_no: item.product?.design_no, size: item.product?.size, colour: item.product?.colour,
          barcode: item.product?.barcode || item.product?.sku, categories: item.product?.categories
        }
      }))
    }))

    // Combine database invoices and local pending sales, avoiding duplicates by invoice_no
    const combinedMap = new Map<string, Invoice>()
    for (const inv of pendingMapped) {
      if (paymentFilter !== 'all' && tenderOf(inv, paymentFilter as any) <= 0) continue
      combinedMap.set(inv.invoice_no, inv)
    }
    for (const inv of fetchedInvoices) {
      combinedMap.set(inv.invoice_no, inv)
    }

    const allMerged = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    if (mine !== latest.current) return   // a newer date choice is already loading
    setInvoices(allMerged)
    fresh.current = true; shown.current = true
    // Only the view the screen opens on (this month, all payments, all salesmen) is kept.
    if (dateRange === 'month' && paymentFilter === 'all' && salesmanFilter === 'all') void writeLocal('invoices:month', allMerged)
    setLoading(false)
  }

  // Exchanges in the same dates. They have no salesman or sale payment mode, so those filters hide them.
  const fetchExchanges = async () => {
    if (salesmanFilter !== 'all' || paymentFilter === 'credit_overdue_15') { setExchanges([]); return }
    const { from, to } = getDateFilter()
    let q = supabase.from('exchange_bills')
      .select('id, exchange_no, original_invoice_no, original_sale_id, created_at, return_amount, new_sale_amount, balance_amount, balance_type, cash_amount, card_amount, upi_amount, credit_amount, customers(name, phone)')
      .order('created_at', { ascending: false })
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lt('created_at', to)
    if (paymentFilter !== 'all') q = q.gt(`${paymentFilter}_amount`, 0)   // an exchange's top-up / pending amount, by mode
    const { data, error } = await q
    if (error) return   // offline or table missing: just no exchange rows
    const rows = (data || []) as unknown as ExchangeRow[]
    // The salesman of the bill being exchanged; if this lookup fails the column just shows a dash.
    try {
      const ids = [...new Set(rows.map(r => r.original_sale_id).filter(Boolean))] as string[]
      if (ids.length) {
        const { data: bills } = await supabase.from('sales').select('id, users(name)').in('id', ids)
        const by = new Map((bills || []).map((b: any) => [b.id, b.users?.name || null]))
        rows.forEach(r => { r.salesman_name = (r.original_sale_id && by.get(r.original_sale_id)) || null })
      }
      // The salesman who made the exchange (EXCHANGE_SALESMAN.sql); older exchanges keep the bill's salesman.
      const { data: own, error: ownErr } = await supabase.from('exchange_bills').select('id, salesman_id').in('id', rows.map(r => r.id))
      if (!ownErr && own?.some((o: any) => o.salesman_id)) {
        const uids = [...new Set(own.map((o: any) => o.salesman_id).filter(Boolean))] as string[]
        const { data: us } = await supabase.from('users').select('id, name').in('id', uids)
        const names = new Map((us || []).map((u: any) => [u.id, u.name]))
        const byEx = new Map(own.map((o: any) => [o.id, o.salesman_id]))
        rows.forEach(r => { const n = names.get(byEx.get(r.id) as string); if (n) { r.salesman_name = n; r.salesman_made_it = true } })
      }
    } catch { /* leave the salesman blank */ }
    setExchanges(rows)
  }

  const fetchSalesmen = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('is_active', true)
      if (error) throw error
      setSalesmen((data as Salesman[]) || [])
    } catch (e) {
      console.error('Failed to fetch salesmen:', e)
    }
  }

  // Open with this PC's copy of this month's bills; the fetch below replaces it.
  useEffect(() => {
    seedLocal<Invoice[]>('invoices:month', d => { setInvoices(d); setLoading(false); shown.current = true }, () => fresh.current)
  }, [])
  useEffect(() => {
    fetchInvoices()
    void fetchExchanges()
  }, [dateRange, paymentFilter, salesmanFilter, customFrom, customTo])
  useLiveRefresh(['sales'], fetchInvoices)
  useLiveRefresh(['exchange_bills'], fetchExchanges)

  useEffect(() => {
    fetchSalesmen()
  }, [])

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      inv.invoice_no.toLowerCase().includes(q) ||
      inv.customers?.name?.toLowerCase().includes(q) ||
      (inv.customers?.phone || '').includes(q)
    )
  })

  const filteredExchanges = exchanges.filter((x) => {
    if (!search) return true
    const q = search.toLowerCase()
    return x.exchange_no.toLowerCase().includes(q) || (x.original_invoice_no || '').toLowerCase().includes(q) ||
      (x.customers?.name || '').toLowerCase().includes(q) || (x.customers?.phone || '').includes(q)
  })

  // Bills and exchanges in ONE list, by the time each was made (newest first).
  const billRows = [
    ...filteredInvoices.map(inv => ({ kind: 'sale' as const, at: inv.created_at, inv })),
    ...filteredExchanges.map(x => ({ kind: 'exchange' as const, at: x.created_at, x })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || (a.kind === 'sale' ? -1 : 1))

  const totalRevenue = invoices.reduce(
    (sum, inv) => sum + (inv.net_amount || 0),
    0
  )

  const totalGST = invoices.reduce(
    (sum, inv) => sum + (inv.gst_amount || 0),
    0
  )

  const avgBillValue =
    invoices.length > 0 ? totalRevenue / invoices.length : 0

  // Money in by how it was actually paid. A ₹1,500 bill paid ₹1,300 UPI + ₹200
  // cash adds ₹200 to Cash and ₹1,300 to UPI — counting the whole bill under its
  // single payment_mode put all ₹1,500 in one place. Bills saved before the split
  // was recorded have no tender amounts; those still count by payment_mode.
  const paymentBreakdown = Object.fromEntries((['cash', 'card', 'upi', 'credit'] as const).map(mode => {
    const bills = invoices.filter(i => !i.is_return && tenderOf(i, mode) > 0)
    return [mode, { count: bills.length, total: bills.reduce((s, i) => s + tenderOf(i, mode), 0) }]
  })) as Record<'cash' | 'card' | 'upi' | 'credit', { count: number; total: number }>

  const processRefund = async (invoice: Invoice) => {
    try {
      // Mark original as returned
      const { error: updateError } = await supabase
        .from('sales')
        .update({ is_return: true })
        .eq('id', invoice.id)

      if (updateError) throw updateError

      // Restore stock for each item
      for (const item of invoice.sale_items || []) {
        const productId = item.products?.id
        if (productId) {
          const { error: restockError } = await supabase.rpc(
            'increment_stock',
            {
              p_id: productId,
              qty: item.qty
            }
          )
          if (restockError) throw restockError
        }
      }

      toast.success(`Refund processed for ${invoice.invoice_no}`)
      await fetchInvoices()
    } catch (e) {
      console.error('Refund failed:', e)
      toast.error('Refund failed')
    }
  }

  return {
    invoices: filteredInvoices,
    exchanges: filteredExchanges,
    billRows,
    loading,
    search,
    setSearch,
    paymentFilter,
    setPaymentFilter,
    salesmanFilter,
    setSalesmanFilter,
    dateRange,
    setDateRange,
    customFrom, setCustomFrom, customTo, setCustomTo, todayStr,
    salesmen,
    totalRevenue,
    totalGST,
    avgBillValue,
    paymentBreakdown,
    processRefund,
    fetchInvoices
  }
}

// Money in by how it was actually paid (see paymentBreakdown). Also used by Reports.
export function tenderOf(i: any, mode: 'cash' | 'card' | 'upi' | 'credit'): number {
  const t = { cash: i.cash_amount, card: i.card_amount, upi: i.upi_amount, credit: i.credit_amount }
  const recorded = Object.values(t).some(v => Number(v) > 0)
  return recorded ? Number(t[mode]) || 0 : (i.payment_mode === mode ? Number(i.net_amount) || 0 : 0)
}
