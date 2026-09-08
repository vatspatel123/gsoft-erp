import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getPendingSales } from '../utils/offlineCache'

const IST_OFFSET = 5.5 * 60 * 60 * 1000

export function useReports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'gst' | 'pnl' | 'staff' | 'daily'>('sales')
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [salesData, setSalesData] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10))

  const startOfDay = (d: Date) => {
    const i = new Date(d.getTime() + IST_OFFSET)
    return new Date(
      Date.UTC(
        i.getUTCFullYear(),
        i.getUTCMonth(),
        i.getUTCDate(),
        0,
        0,
        0
      ) - IST_OFFSET
    ).toISOString()
  }

  const endOfDay = (d: Date) => {
    const i = new Date(d.getTime() + IST_OFFSET)
    return new Date(
      Date.UTC(
        i.getUTCFullYear(),
        i.getUTCMonth(),
        i.getUTCDate(),
        23,
        59,
        59
      ) - IST_OFFSET
    ).toISOString()
  }

  const getRange = () => {
    const now = new Date()
    const ist = new Date(now.getTime() + IST_OFFSET)

    switch (dateRange) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) }
      case 'yesterday': {
        const y = new Date(now.getTime() - 86400000)
        return { from: startOfDay(y), to: endOfDay(y) }
      }
      case 'this_week': {
        const w = new Date(now.getTime() - 6 * 86400000)
        return { from: startOfDay(w), to: endOfDay(now) }
      }
      case 'this_month': {
        const ms = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0) - IST_OFFSET)
        return { from: ms.toISOString(), to: endOfDay(now) }
      }
      case 'last_month': {
        const lms = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1, 0, 0, 0) - IST_OFFSET)
        const lme = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 0, 23, 59, 59) - IST_OFFSET)
        return { from: lms.toISOString(), to: lme.toISOString() }
      }
      case 'custom': {
        const fromDate = customFrom ? new Date(customFrom) : now
        const toDate = customTo ? new Date(customTo) : now
        return { from: startOfDay(fromDate), to: endOfDay(toDate) }
      }
      default:
        return { from: startOfDay(now), to: endOfDay(now) }
    }
  }

  const fetchReportData = async () => {
    setLoading(true)
    const { from, to } = getRange()

    let dbSales: any[] = []
    let dbItems: any[] = []
    let dbProducts: any[] = []

    try {
      if (navigator.onLine) {
        const [salesRes, itemsRes, productsRes] = await Promise.all([
          supabase
            .from('sales')
            .select(`
              *,
              customers(name, phone),
              users(id, name, role),
              sale_items(
                id, qty, line_total,
                unit_price, gst_rate,
                products(id, name, cost_price, unit_price)
              )
            `)
            .gte('created_at', from)
            .lte('created_at', to)
            .eq('is_return', false)
            .order('created_at', { ascending: false }),

          supabase
            .from('sale_items')
            .select(`
              qty, line_total,
              unit_price, gst_rate,
              products(name, cost_price),
              sales!inner(created_at, is_return)
            `)
            .gte('sales.created_at', from)
            .lte('sales.created_at', to)
            .eq('sales.is_return', false),

          supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
        ])

        dbSales = salesRes.data || []
        dbItems = itemsRes.data || []
        dbProducts = productsRes.data || []
      }
    } catch (e) {
      console.warn('Network error loading report data, using local cache:', e)
    }

    const pending = getPendingSales() || []
    const pendingSalesMapped = pending.map((p: any) => ({
      id: p.saleId || 'local-' + p.pendingId,
      invoice_no: p.invoiceNo || 'INV-LOCAL',
      net_amount: p.netAmount || p.net_amount || 0,
      gst_amount: p.gstAmount || p.gst_amount || 0,
      discount_amount: p.totalDiscount || p.discount_amount || 0,
      total_amount: p.subtotal || p.total_amount || 0,
      payment_mode: p.paymentMode || p.payment_mode || 'cash',
      is_return: false,
      created_at: p.createdAt || p.date || new Date().toISOString(),
      customers: p.customer ? { name: p.customer.name, phone: p.customer.phone } : null,
      users: p.salesmanName ? { name: p.salesmanName } : null,
      sale_items: p.cart?.map((i: any) => ({
        qty: i.qty,
        unit_price: i.unit_price,
        line_total: i.line_total,
        gst_rate: i.product?.gst_rate || 0,
        products: {
          id: i.product?.id,
          name: i.product?.name || 'Product',
          cost_price: i.product?.cost_price || 0,
          unit_price: i.unit_price
        }
      }))
    }))

    const pendingItemsMapped: any[] = []
    for (const p of pending) {
      for (const item of p.cart || []) {
        pendingItemsMapped.push({
          qty: item.qty,
          line_total: item.line_total,
          unit_price: item.unit_price,
          gst_rate: item.product?.gst_rate || 0,
          products: {
            name: item.product?.name || 'Product',
            cost_price: item.product?.cost_price || 0
          }
        })
      }
    }

    // Combine DB sales and pending sales, avoiding duplicates by invoice_no
    const combinedSalesMap = new Map<string, any>()
    for (const s of pendingSalesMapped) combinedSalesMap.set(s.invoice_no, s)
    for (const s of dbSales) combinedSalesMap.set(s.invoice_no, s)

    setSalesData(Array.from(combinedSalesMap.values()))
    setSaleItems([...dbItems, ...pendingItemsMapped])
    setProducts(dbProducts)

    setLoading(false)
  }

  useEffect(() => {
    fetchReportData()
  }, [dateRange, customFrom, customTo, dailyDate])

  const totalRevenue = salesData.reduce((s, sale) => s + (Number(sale.net_amount) || 0), 0)
  const totalGST = salesData.reduce((s, sale) => s + (Number(sale.gst_amount) || 0), 0)
  const totalDiscount = salesData.reduce((s, sale) => s + (Number(sale.discount_amount) || 0), 0)
  const totalCost = saleItems.reduce((s, item) => {
    const cost = Number(item.products?.cost_price || 0)
    if (!cost) return s
    return s + cost * (item.qty || 0)
  }, 0)
  const grossProfit = totalRevenue - totalCost
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  return {
    activeTab,
    setActiveTab,
    dateRange,
    setDateRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dailyDate,
    setDailyDate,
    loading,
    salesData,
    saleItems,
    products,
    totalRevenue,
    totalGST,
    totalDiscount,
    totalCost,
    grossProfit,
    grossMargin,
    fetchReportData,
    getRange
  }
}
