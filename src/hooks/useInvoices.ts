import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { getPendingSales } from '../utils/offlineCache'
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
  credit_due_date?: string
  credit_due_days?: number
  is_return: boolean
  created_at: string
  edit_count?: number
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

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [salesmanFilter, setSalesmanFilter] = useState('all')
  const [dateRange, setDateRange] = useState('month')
  const [salesmen, setSalesmen] = useState<Salesman[]>([])

  // Day boundaries in the shop's own time (this PC's clock), not UTC. The list
  // opens on This Month: opening on Today hid yesterday's bills, which looked
  // like they had been lost.
  const getDateFilter = (): { from: string | null; to: string | null } => {
    const now = new Date()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const tomorrow = new Date(startOfDay(now).getTime() + 86400000).toISOString()
    if (dateRange === 'all') return { from: null, to: null }
    if (dateRange === 'week') return { from: new Date(startOfDay(now).getTime() - 6 * 86400000).toISOString(), to: tomorrow }
    if (dateRange === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: tomorrow }
    return { from: startOfDay(now).toISOString(), to: tomorrow }
  }

  const fetchInvoices = async () => {
    setLoading(true)
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
          query = query.eq('payment_mode', 'credit').lte('created_at', fifteenDaysAgo)
        } else {
          if (from) query = query.gte('created_at', from)
          if (to) query = query.lt('created_at', to)

          if (paymentFilter !== 'all') {
            query = query.eq('payment_mode', paymentFilter)
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
      is_return: false,
      created_at: p.createdAt || p.date || new Date().toISOString(),
      customers: p.customer ? { name: p.customer.name, phone: p.customer.phone } : null,
      users: p.salesmanName ? { name: p.salesmanName } : null,
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
          gst_rate: item.product?.gst_rate || 0
        }
      }))
    }))

    // Combine database invoices and local pending sales, avoiding duplicates by invoice_no
    const combinedMap = new Map<string, Invoice>()
    for (const inv of pendingMapped) {
      if (paymentFilter !== 'all' && inv.payment_mode !== paymentFilter) continue
      combinedMap.set(inv.invoice_no, inv)
    }
    for (const inv of fetchedInvoices) {
      combinedMap.set(inv.invoice_no, inv)
    }

    const allMerged = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    setInvoices(allMerged)
    setLoading(false)
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

  useEffect(() => {
    fetchInvoices()
  }, [dateRange, paymentFilter, salesmanFilter])
  useLiveRefresh(['sales'], fetchInvoices)

  useEffect(() => {
    fetchSalesmen()
  }, [])

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      inv.invoice_no.toLowerCase().includes(q) ||
      inv.customers?.name?.toLowerCase().includes(q)
    )
  })

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
    loading,
    search,
    setSearch,
    paymentFilter,
    setPaymentFilter,
    salesmanFilter,
    setSalesmanFilter,
    dateRange,
    setDateRange,
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
