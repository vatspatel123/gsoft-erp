import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

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
  const [filter, setFilter] = useState('all')

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching customers:', error)
        setCustomers([])
      } else {
        setCustomers(data || [])
      }
    } catch (e) {
      console.error('Fetch customers error:', e)
      setCustomers([])
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
      if (filter === 'vip') return c.total_spent > 10000
      if (filter === 'regular') return c.total_spent > 0 && c.total_spent <= 10000
      if (filter === 'new') return c.total_spent === 0 || !c.total_spent
      return true
    })

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
      if (editId) {
        const { error } = await supabase
          .from('customers')
          .update(data)
          .eq('id', editId)

        if (error) throw error
        toast.success('Customer updated!')
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            ...data,
            loyalty_points: 0,
            total_spent: 0,
            referral_code: Math.random().toString(36).substring(2, 10)
          })

        if (error) throw error
        toast.success('Customer added!')
      }
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
          points_change: points,
          type: 'manual_credit',
          notes: reason
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
    fetchCustomers
  }
}
