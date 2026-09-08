import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCachedProducts, getPendingSales } from '../utils/offlineCache';

// IST Timezone Constants & Helpers
const IST_OFFSET = 5.5 * 60 * 60 * 1000

const toIST = (date: Date) => 
  new Date(date.getTime() + IST_OFFSET)

const getISTDateRange = (
  range: string,
  customFrom?: string,
  customTo?: string
) => {
  const now = new Date()
  const istNow = toIST(now)

  const startOfISTDay = (d: Date) => {
    const ist = toIST(d)
    return new Date(
      Date.UTC(
        ist.getUTCFullYear(),
        ist.getUTCMonth(),
        ist.getUTCDate(),
        0, 0, 0
      ) - IST_OFFSET
    )
  }

  const endOfISTDay = (d: Date) => {
    const ist = toIST(d)
    return new Date(
      Date.UTC(
        ist.getUTCFullYear(),
        ist.getUTCMonth(),
        ist.getUTCDate(),
        23, 59, 59
      ) - IST_OFFSET
    )
  }

  switch(range) {
    case 'today':
      return {
        from: startOfISTDay(now).toISOString(),
        to: endOfISTDay(now).toISOString(),
        label: 'Today'
      }
    
    case 'yesterday': {
      const yesterday = new Date(
        now.getTime() - 
        24 * 60 * 60 * 1000
      )
      return {
        from: startOfISTDay(yesterday)
          .toISOString(),
        to: endOfISTDay(yesterday)
          .toISOString(),
        label: 'Yesterday'
      }
    }
    
    case 'week': {
      const weekAgo = new Date(
        now.getTime() - 
        6 * 24 * 60 * 60 * 1000
      )
      return {
        from: startOfISTDay(weekAgo)
          .toISOString(),
        to: endOfISTDay(now).toISOString(),
        label: 'This Week'
      }
    }
    
    case 'month': {
      const ist = toIST(now)
      const monthStart = new Date(
        Date.UTC(
          ist.getUTCFullYear(),
          ist.getUTCMonth(),
          1, 0, 0, 0
        ) - IST_OFFSET
      )
      return {
        from: monthStart.toISOString(),
        to: endOfISTDay(now).toISOString(),
        label: 'This Month'
      }
    }
    
    case 'last_month': {
      const ist = toIST(now)
      const lastMonthStart = new Date(
        Date.UTC(
          ist.getUTCFullYear(),
          ist.getUTCMonth() - 1,
          1, 0, 0, 0
        ) - IST_OFFSET
      )
      const lastMonthEnd = new Date(
        Date.UTC(
          ist.getUTCFullYear(),
          ist.getUTCMonth(),
          0, 23, 59, 59
        ) - IST_OFFSET
      )
      return {
        from: lastMonthStart.toISOString(),
        to: lastMonthEnd.toISOString(),
        label: 'Last Month'
      }
    }
    
    case 'custom':
      if (customFrom && customTo) {
        return {
          from: startOfISTDay(
            new Date(customFrom)
          ).toISOString(),
          to: endOfISTDay(
            new Date(customTo)
          ).toISOString(),
          label: customFrom + 
            ' to ' + customTo
        }
      }
      return {
        from: startOfISTDay(now)
          .toISOString(),
        to: endOfISTDay(now).toISOString(),
        label: 'Today'
      }
    
    default:
      return {
        from: startOfISTDay(now)
          .toISOString(),
        to: endOfISTDay(now).toISOString(),
        label: 'Today'
      }
  }
}

const getISTDateLabel = (utcDateStr: string) => {
  const utcDate = new Date(utcDateStr)
  const istDate = new Date(
    utcDate.getTime() + IST_OFFSET
  )
  return istDate.toLocaleDateString(
    'en-IN', {
      day: '2-digit', month: 'short'
    }
  )
}

export interface DashboardData {
  todayRevenue: number;
  allTimeRevenue: number;
  yesterdayRevenue: number;
  todayOrders: number;
  allTimeOrders: number;
  yesterdayOrders: number;
  lowStockCount: number;
  todayCustomers: number;
  allTimeCustomers: number;
  recentSales: any[];
  topProducts: any[];
  lowStockList: any[];
  weeklyRevenue: any[];
  birthdayCustomers: any[];
  salesmanData: any[];
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData>({
    todayRevenue: 0,
    allTimeRevenue: 0,
    yesterdayRevenue: 0,
    todayOrders: 0,
    allTimeOrders: 0,
    yesterdayOrders: 0,
    lowStockCount: 0,
    todayCustomers: 0,
    allTimeCustomers: 0,
    recentSales: [],
    topProducts: [],
    lowStockList: [],
    weeklyRevenue: [],
    birthdayCustomers: [],
    salesmanData: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { from, to } = getISTDateRange(
        dateRange, customFrom, customTo
      )

      let dbSales: any[] = []
      let dbProducts: any[] = []
      let dbAllTimeSales: any[] = []

      if (navigator.onLine) {
        try {
          const { data: sales } = await supabase
            .from('sales')
            .select(`
              id, invoice_no, net_amount,
              gst_amount, discount_amount,
              total_amount, payment_mode,
              created_at, customer_id,
              salesman_id,
              customers(name, phone),
              users(name),
              sale_items(
                id, qty, line_total,
                unit_price, product_id,
                products(name, unit_price)
              )
            `)
            .gte('created_at', from)
            .lte('created_at', to)
            .eq('is_return', false)
            .order('created_at', { ascending: false })

          if (sales) dbSales = sales

          const { data: allSales } = await supabase
            .from('sales')
            .select('net_amount, customer_id, created_at')
          if (allSales) dbAllTimeSales = allSales

          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
          if (products) dbProducts = products
        } catch (dbErr) {
          console.warn('Dashboard DB query warning, using local cache:', dbErr)
        }
      }

      // Merge local pending sales
      const pendingSales = getPendingSales() || []
      const pendingMapped = pendingSales.map((p: any) => ({
        id: p.saleId || 'local-' + p.pendingId,
        invoice_no: p.invoiceNo || 'INV-LOCAL',
        customer_id: p.customer?.id,
        salesman_id: p.salesmanId,
        net_amount: p.netAmount || p.net_amount || 0,
        gst_amount: p.gstAmount || p.gst_amount || 0,
        discount_amount: p.totalDiscount || p.discount_amount || 0,
        total_amount: p.subtotal || p.total_amount || 0,
        payment_mode: p.paymentMode || p.payment_mode || 'cash',
        created_at: p.createdAt || p.date || new Date().toISOString(),
        customers: p.customer ? { name: p.customer.name, phone: p.customer.phone } : null,
        users: p.salesmanName ? { name: p.salesmanName } : null,
        sale_items: p.cart?.map((i: any) => ({
          id: 'item-' + Math.random(),
          qty: i.qty,
          unit_price: i.unit_price,
          line_total: i.line_total,
          products: { name: i.product?.name || 'Product', unit_price: i.unit_price }
        }))
      }))

      // Combine sales by invoice_no
      const combinedSalesMap = new Map<string, any>()
      for (const p of pendingMapped) combinedSalesMap.set(p.invoice_no, p)
      for (const s of dbSales) combinedSalesMap.set(s.invoice_no, s)
      const allSalesList = Array.from(combinedSalesMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Range sales filtering
      const rangeSales = allSalesList.filter(s => {
        const sTime = new Date(s.created_at).getTime()
        return sTime >= new Date(from).getTime() && sTime <= new Date(to).getTime()
      })
      const activeSales = rangeSales.length > 0 ? rangeSales : allSalesList

      const revenue = activeSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      const uniqueCustomers = new Set(activeSales.map(s => s.customer_id).filter(Boolean)).size

      // All-time totals
      const allTimeRevenue = allSalesList.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      const allTimeOrders = allSalesList.length
      const allTimeCustomers = new Set(allSalesList.map(s => s.customer_id).filter(Boolean)).size

      // Yesterday's sales
      const { from: yesterdayFrom, to: yesterdayTo } = getISTDateRange('yesterday')
      const yesterdaySales = allSalesList.filter(s => {
        const t = new Date(s.created_at).getTime()
        return t >= new Date(yesterdayFrom).getTime() && t <= new Date(yesterdayTo).getTime()
      })
      const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      const yesterdayOrders = yesterdaySales.length

      // Merge cached products for low stock calculations
      const cachedProducts = getCachedProducts() || []
      const productMap = new Map<string, any>()
      for (const p of cachedProducts) if (p.is_active !== false) productMap.set(p.id, p)
      for (const p of dbProducts) productMap.set(p.id, p)
      const allActiveProducts = Array.from(productMap.values())

      const allLowStock = allActiveProducts.filter(p => (p.stock_qty || 0) <= (p.low_stock_alert || 5))
      allLowStock.sort((a, b) => (a.stock_qty || 0) - (b.stock_qty || 0))
      const lowStockList = allLowStock.slice(0, 6)
      const lowStockCount = allLowStock.length

      // Weekly revenue
      const { from: weekFrom, to: weekTo } = getISTDateRange('week')
      const weeklySales = allSalesList.filter(s => {
        const t = new Date(s.created_at).getTime()
        return t >= new Date(weekFrom).getTime() && t <= new Date(weekTo).getTime()
      })
      const grouped: Record<string, number> = {}
      weeklySales.forEach((s: any) => {
        const date = getISTDateLabel(s.created_at)
        if (!grouped[date]) grouped[date] = 0
        grouped[date] += Number(s.net_amount || 0)
      })
      const weeklyRevenue = Object.entries(grouped).map(([date, amount]) => ({ date, name: date, amount }))

      // Top Products
      const topProductsMap: Record<string, any> = {}
      allSalesList.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          const name = item.products?.name || 'Product'
          if (!topProductsMap[name]) topProductsMap[name] = { name, qty: 0, revenue: 0 }
          topProductsMap[name].qty += (item.qty || 0)
          topProductsMap[name].revenue += (item.line_total || 0)
        })
      })
      const topProducts = Object.values(topProductsMap)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)

      // Salesman Performance
      const salesmanMap: Record<string, any> = {}
      allSalesList.forEach(s => {
        const name = s.users?.name || s.salesmanName || 'Cashier'
        if (!salesmanMap[name]) salesmanMap[name] = { id: name, name, role: 'Cashier', sales: 0, revenue: 0 }
        salesmanMap[name].sales++
        salesmanMap[name].revenue += Number(s.net_amount || 0)
      })
      const salesmanData = Object.values(salesmanMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)

      setData({
        todayRevenue: revenue,
        allTimeRevenue,
        yesterdayRevenue,
        todayOrders: activeSales.length,
        allTimeOrders,
        yesterdayOrders,
        lowStockCount,
        todayCustomers: uniqueCustomers,
        allTimeCustomers,
        recentSales: allSalesList.slice(0, 5),
        topProducts,
        lowStockList,
        weeklyRevenue,
        birthdayCustomers: [],
        salesmanData
      })
    } catch (err: any) {
      console.error('Dashboard fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Fetch when date range changes
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [dateRange, customFrom, customTo]);

  return { 
    data, 
    loading, 
    error, 
    refresh: fetchDashboardData,
    dateRange,
    setDateRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo
  };
}
