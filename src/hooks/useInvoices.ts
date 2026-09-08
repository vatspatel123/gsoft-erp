import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { getPendingSales } from '../utils/offlineCache'

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
  is_return: boolean
  created_at: string
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
  const [dateRange, setDateRange] = useState('today')
  const [salesmen, setSalesmen] = useState<Salesman[]>([])

  const getDateFilter = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    if (dateRange === 'today') {
      return { from: today, to: today }
    }

    if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return {
        from: weekAgo.toISOString().split('T')[0],
        to: today
      }
    }

    if (dateRange === 'month') {
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
      return {
        from: monthStart.toISOString().split('T')[0],
        to: today
      }
    }

    return { from: today, to: today }
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
              products(id, name, gst_rate)
            )`
          )
          .order('created_at', { ascending: false })

        if (paymentFilter === 'credit_overdue_15') {
          const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          query = query.eq('payment_mode', 'credit').lte('created_at', fifteenDaysAgo)
        } else {
          query = query
            .gte('created_at', from + 'T00:00:00')
            .lte('created_at', to + 'T23:59:59')

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

  const paymentBreakdown = {
    cash: invoices.filter((i) => i.payment_mode === 'cash'),
    card: invoices.filter((i) => i.payment_mode === 'card'),
    upi: invoices.filter((i) => i.payment_mode === 'upi'),
    credit: invoices.filter((i) => i.payment_mode === 'credit')
  }

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
