import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
      console.log('=== DASHBOARD FETCH ===')
      console.log('Date range:', dateRange)
      
      const { from, to } = getISTDateRange(
        dateRange, customFrom, customTo
      )
      
      console.log('From:', from)
      console.log('To:', to)

      // STEP 1: Debug query - check if basic filter works
      const { data: sales, error } = 
        await supabase
          .from('sales')
          .select('*')
          .gte('created_at', from)
          .lte('created_at', to)

      console.log('Sales found:', sales?.length)
      console.log('Error:', error)
      console.log('First sale:', sales?.[0])

      // STEP 2: No-filter query to confirm data exists
      const { data: allSales } = await supabase
        .from('sales')
        .select('id, invoice_no, net_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      console.log('ALL sales (no filter):', 
        allSales?.map(s => ({
          invoice: s.invoice_no,
          amount: s.net_amount,
          date: s.created_at
        }))
      )

      // STEP 3: Simple fetch that works
      const { data: fullSalesData } = await supabase
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
        .order('created_at', { 
          ascending: false 
        })

      console.log('Sales result:', 
        fullSalesData?.length, fullSalesData?.[0]?.created_at
      )

      const revenue = (fullSalesData || []).reduce(
        (sum, s) => sum + (s.net_amount || 0), 0
      )
      const gst = (fullSalesData || []).reduce(
        (sum, s) => sum + (s.gst_amount || 0), 0
      )
      const uniqueCustomers = new Set(
        (fullSalesData || [])
          .filter(s => s.customer_id)
          .map(s => s.customer_id)
      ).size

      // All-time totals for fallback
      const { data: allTimeSalesData } = await supabase
        .from('sales')
        .select('net_amount, customer_id')

      const allTimeRevenue = allTimeSalesData?.reduce((sum, sale) => sum + Number(sale.net_amount), 0) || 0
      const allTimeOrders = allTimeSalesData?.length || 0
      const allTimeCustomers = new Set(allTimeSalesData?.map(s => s.customer_id).filter(Boolean)).size

      // Yesterday's sales
      const { from: yesterdayFrom, to: yesterdayTo } = getISTDateRange('yesterday')
      const { data: yesterdaySalesData } = await supabase
        .from('sales')
        .select('net_amount')
        .gte('created_at', yesterdayFrom)
        .lte('created_at', yesterdayTo)

      const yesterdayRevenue = yesterdaySalesData?.reduce((sum, sale) => sum + Number(sale.net_amount), 0) || 0
      const yesterdayOrders = yesterdaySalesData?.length || 0

      // Low stock products
      const { data: activeProducts } = await supabase
        .from('products')
        .select('name, stock_qty, low_stock_alert')
        .eq('is_active', true)
      
      const allLowStock = activeProducts?.filter(p => p.stock_qty <= (p.low_stock_alert || 0)) || []
      allLowStock.sort((a, b) => a.stock_qty - b.stock_qty)
      const lowStockList = allLowStock.slice(0, 6)
      const lowStockCount = allLowStock.length

      // Weekly revenue
      const { from: weekFrom, to: weekTo } = getISTDateRange('week')
      const { data: weeklySalesData } = await supabase
        .from('sales')
        .select('created_at, net_amount')
        .gte('created_at', weekFrom)
        .lte('created_at', weekTo)
        .order('created_at', { ascending: true })

      const grouped: Record<string, number> = {}
      weeklySalesData?.forEach((sale: any) => {
        const date = getISTDateLabel(sale.created_at)
        if (!grouped[date]) grouped[date] = 0
        grouped[date] += Number(sale.net_amount) || 0
      })

      const weeklyRevenue = Object.entries(grouped)
        .map(([date, amount]) => ({
          date,
          name: date,
          amount
        }))

      // Birthday customers
      const monthStr = String(new Date().getMonth() + 1).padStart(2, '0')
      const dayStr = String(new Date().getDate()).padStart(2, '0')
      
      const { data: bdayData } = await supabase
        .from('customers')
        .select('name, phone')
        .like('date_of_birth', `%-${monthStr}-${dayStr}`)

      // Top Products (all-time, by revenue)
      const { data: allSaleItems } = await supabase
        .from('sale_items')
        .select(`
          qty,
          line_total,
          products(
            id, name, unit_price
          )
        `)

      let topProducts: any[] = []
      if (allSaleItems) {
        const productMap: Record<string, any> = {}
        
        allSaleItems.forEach((item: any) => {
          const name = item.products?.name || 'Unknown'
          const id = item.products?.id || name
          
          if (!productMap[id]) {
            productMap[id] = {
              name,
              qty: 0,
              revenue: 0
            }
          }
          productMap[id].qty += (item.qty || 0)
          productMap[id].revenue += (item.line_total || 0)
        })

        topProducts = Object.values(productMap)
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 5)
      }

      // Salesman Performance
      const { data: salesWithSalesman } = await supabase
        .from('sales')
        .select(`
          salesman_id,
          net_amount,
          users(id, name, role)
        `)
        .eq('is_return', false)

      let salesmanData: any[] = []
      if (salesWithSalesman) {
        const salesmanMap: Record<string, any> = {}

        salesWithSalesman.forEach((s: any) => {
          const uid = s.users?.id || s.salesman_id || 'unknown'
          const name = s.users?.name || 'Unknown'
          const role = s.users?.role || 'Cashier'

          if (!salesmanMap[uid]) {
            salesmanMap[uid] = {
              id: uid,
              name,
              role,
              sales: 0,
              revenue: 0
            }
          }
          salesmanMap[uid].sales++
          salesmanMap[uid].revenue += s.net_amount || 0
        })

        salesmanData = Object.values(salesmanMap)
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 5)
      }

      setData({
        todayRevenue: revenue,
        allTimeRevenue,
        yesterdayRevenue,
        todayOrders: fullSalesData?.length || 0,
        allTimeOrders,
        yesterdayOrders,
        lowStockCount,
        todayCustomers: uniqueCustomers,
        allTimeCustomers,
        recentSales: fullSalesData?.slice(0, 5) || [],
        topProducts,
        lowStockList,
        weeklyRevenue: weeklyRevenue.length > 0 ? weeklyRevenue : [],
        birthdayCustomers: bdayData || [],
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
