import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

    try {
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

      setSalesData(salesRes.data || [])
      setSaleItems(itemsRes.data || [])
      setProducts(productsRes.data || [])
    } catch (e) {
      console.error('Failed to load report data', e)
    }

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
