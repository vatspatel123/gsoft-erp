import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { saveCustomerToCache, getCachedCustomers } from '../utils/offlineCache'
import { calculateCustomerTier, type CustomerTier } from '../utils/customerTier'

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  date_of_birth?: string
  address?: string
  notes?: string
  loyalty_points: number
  total_spent: number
  referral_code: string
  created_at: string
  tier?: CustomerTier
  bills_count?: number
  yearly_spent?: number
}

export interface Sale {
  id: string
  customer_id: string
  invoice_number: string
  total_amount: number
  payment_method: string
  created_at: string
  sale_items?: Array<{
    qty: number
    line_total: number
    products: {
      name: string
    }
  }>
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data && data.length > 0) {
          // Fetch sales summary for tier calculation
          let salesMap: Record<string, { count: number; maxBill: number; yearly: number }> = {}
          try {
            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
            const { data: allSales } = await supabase
              .from('sales')
              .select('customer_id, net_amount, created_at')
              .eq('is_return', false)

            if (allSales) {
              for (const s of allSales) {
                if (!s.customer_id) continue
                if (!salesMap[s.customer_id]) {
                  salesMap[s.customer_id] = { count: 0, maxBill: 0, yearly: 0 }
                }
                salesMap[s.customer_id].count += 1
                salesMap[s.customer_id].maxBill = Math.max(salesMap[s.customer_id].maxBill, s.net_amount || 0)
                if (s.created_at >= oneYearAgo) {
                  salesMap[s.customer_id].yearly += (s.net_amount || 0)
                }
              }
            }
          } catch {}

          const enriched = data.map(c => {
            const sInfo = salesMap[c.id] || { count: 0, maxBill: 0, yearly: 0 }
            const tier = calculateCustomerTier({
              billsCount: sInfo.count,
              maxSingleBill: sInfo.maxBill,
              yearlySpent: sInfo.yearly,
              lifetimeSpent: c.total_spent || 0
            })
            return {
              ...c,
              tier,
              bills_count: sInfo.count,
              yearly_spent: sInfo.yearly
            }
          })

          setCustomers(enriched)
          for (const c of enriched) saveCustomerToCache(c)
          setLoading(false)
          return
        }
      }
      const cached = getCachedCustomers()
      const cachedEnriched = (cached || []).map((c: any) => ({
        ...c,
        tier: c.tier || calculateCustomerTier({
          billsCount: 1,
          maxSingleBill: c.total_spent || 0,
          yearlySpent: c.total_spent || 0,
          lifetimeSpent: c.total_spent || 0
        })
      }))
      setCustomers(cachedEnriched)
    } catch (e) {
      console.error('Fetch customers error, using cache:', e)
      const cached = getCachedCustomers()
      setCustomers(cached || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const filteredCustomers = customers
    .filter(c => {
      if (search) {
        const q = search.toLowerCase()
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(search) ||
          c.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .filter(c => {
      if (filter === 'all') return true
      if (filter === 'vvip') return c.tier === 'VVIP'
      if (filter === 'vip') return c.tier === 'VIP'
      if (filter === 'regular') return c.tier === 'Regular'
      if (filter === 'new') return c.tier === 'New'
      return true
    })

  const vvipCount = customers.filter(c => c.tier === 'VVIP').length
  const vipCount = customers.filter(c => c.tier === 'VIP').length
  const regularCount = customers.filter(c => c.tier === 'Regular').length
  const newCount = customers.filter(c => c.tier === 'New').length

  const birthdayCustomers = customers.filter(c => {
    if (!c.date_of_birth) return false
    const dob = new Date(c.date_of_birth)
    const today = new Date()
    return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()
  })

  const birthdayThisMonth = customers.filter(c => {
    if (!c.date_of_birth) return false
    const dob = new Date(c.date_of_birth)
    return dob.getMonth() === new Date().getMonth()
  })

  const totalLoyaltyPoints = customers.reduce(
    (sum, c) => sum + (c.loyalty_points || 0),
    0
  )

  const activeTodayCount = customers.filter(c => {
    if (!c.created_at) return false
    const lastVisit = new Date(c.created_at)
    const today = new Date()
    return (
      lastVisit.getDate() === today.getDate() &&
      lastVisit.getMonth() === today.getMonth() &&
      lastVisit.getFullYear() === today.getFullYear()
    )
  }).length

  const saveCustomer = async (data: Partial<Customer>, editId?: string) => {
    try {
      const customerRecord = {
        ...data,
        id: editId || data.id || crypto.randomUUID(),
        name: data.name || 'Customer',
        phone: data.phone || '',
        loyalty_points: data.loyalty_points || 0,
        total_spent: data.total_spent || 0,
        referral_code: data.referral_code || Math.random().toString(36).substring(2, 10),
        created_at: data.created_at || new Date().toISOString()
      }

      if (navigator.onLine) {
        try {
          if (editId) {
            const { error } = await supabase
              .from('customers')
              .update(data)
              .eq('id', editId)
            if (error) console.warn('DB customer update warning:', error.message)
          } else {
            const { error } = await supabase
              .from('customers')
              .insert(customerRecord)
            if (error) console.warn('DB customer insert warning:', error.message)
          }
        } catch (dbErr) {
          console.warn('DB customer save notice, using local cache:', dbErr)
        }
      }

      saveCustomerToCache(customerRecord)
      toast.success(editId ? 'Customer updated!' : 'Customer added!')
      await fetchCustomers()
    } catch (e) {
      console.error('Save customer error:', e)
      toast.error('Failed to save customer')
    }
  }

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Customer deleted')
      await fetchCustomers()
    } catch (e) {
      console.error('Delete customer error:', e)
      toast.error('Failed to delete customer')
    }
  }

  const addLoyaltyPoints = async (
    customerId: string,
    points: number,
    reason: string
  ) => {
    try {
      const customer = customers.find(c => c.id === customerId)
      if (!customer) throw new Error('Customer not found')

      const newPoints = (customer.loyalty_points || 0) + points

      const { error: updateError } = await supabase
        .from('customers')
        .update({ loyalty_points: newPoints })
        .eq('id', customerId)

      if (updateError) throw updateError

      const { error: insertError } = await supabase
        .from('loyalty_transactions')
        .insert({
          customer_id: customerId,
          points_delta: points,
          balance_after: newPoints,
          type: 'bonus'   // CHECK allows earn | redeem | bonus | referral
        })

      if (insertError) throw insertError

      toast.success(points + ' points added!')
      await fetchCustomers()
    } catch (e) {
      console.error('Add loyalty points error:', e)
      toast.error('Failed to add points')
    }
  }

  const getCustomerPurchases = async (customerId: string): Promise<Sale[]> => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(
          `
          *,
          sale_items(
            qty, line_total,
            products(name)
          )
        `
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data || []
    } catch (e) {
      console.error('Get customer purchases error:', e)
      return []
    }
  }

  return {
    customers: filteredCustomers,
    allCustomers: customers,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    birthdayCustomers,
    birthdayThisMonth,
    totalLoyaltyPoints,
    activeTodayCount,
    saveCustomer,
    deleteCustomer,
    addLoyaltyPoints,
    getCustomerPurchases,
    fetchCustomers,
    vvipCount,
    vipCount,
    regularCount,
    newCount
  }
}
