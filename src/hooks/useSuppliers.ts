import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface Supplier {
  id: string
  name: string
  gstin?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  created_at?: string
}

export interface SupplierStats {
  billCount: number
  totalPurchased: number
  outstanding: number
  lastPurchaseAt: string | null
}

const CACHE_KEY = 'gsoft_suppliers_cache'
const EMPTY_STATS: SupplierStats = { billCount: 0, totalPurchased: 0, outstanding: 0, lastPurchaseAt: null }

// Supplier payables are derived from purchase_bills, not from a column on suppliers:
// usePurchaseEntry tries to maintain suppliers.outstanding_balance but that column
// does not exist, so its update is silently skipped and would always read as 0.
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<Record<string, SupplierStats>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name')

        if (!error && data) {
          setSuppliers(data)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.warn('Supplier load notice:', e)
    }
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) setSuppliers(JSON.parse(cached))
    } catch {}
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const { data, error } = await supabase
        .from('purchase_bills')
        .select('supplier_id, net_amount, payment_status, created_at')

      if (error || !data) return

      const next: Record<string, SupplierStats> = {}
      for (const bill of data) {
        if (!bill.supplier_id) continue
        const cur = next[bill.supplier_id] || { ...EMPTY_STATS }
        const amount = Number(bill.net_amount) || 0
        cur.billCount += 1
        cur.totalPurchased += amount
        if (bill.payment_status !== 'paid') cur.outstanding += amount
        if (!cur.lastPurchaseAt || bill.created_at > cur.lastPurchaseAt) {
          cur.lastPurchaseAt = bill.created_at
        }
        next[bill.supplier_id] = cur
      }
      setStats(next)
    } catch (e) {
      console.warn('Supplier stats notice:', e)
    }
  }, [])

  useEffect(() => {
    loadSuppliers()
    loadStats()
  }, [loadSuppliers, loadStats])

  // Same payload shape usePurchaseEntry inserts, so both paths stay compatible.
  const createSupplier = async (payload: Partial<Supplier>): Promise<Supplier | null> => {
    if (!payload.name?.trim()) {
      toast.error('Supplier name is required')
      return null
    }
    const row = {
      name: payload.name.trim(),
      phone: payload.phone?.trim() || null,
      gstin: payload.gstin?.trim() || null,
      address: payload.address?.trim() || null,
      email: payload.email?.trim() || null
    }
    try {
      const { data, error } = await supabase.from('suppliers').insert(row).select().single()
      if (error) throw error
      setSuppliers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Supplier added')
      return data
    } catch (e: any) {
      toast.error('Could not add supplier: ' + (e.message || 'unknown error'))
      return null
    }
  }

  const updateSupplier = async (id: string, patch: Partial<Supplier>) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: patch.name?.trim(),
          phone: patch.phone?.trim() || null,
          gstin: patch.gstin?.trim() || null,
          address: patch.address?.trim() || null,
          email: patch.email?.trim() || null
        })
        .eq('id', id)
      if (error) throw error
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
      toast.success('Supplier updated')
      return true
    } catch (e: any) {
      toast.error('Could not update supplier: ' + (e.message || 'unknown error'))
      return false
    }
  }

  // Blocked when bills exist — deleting would orphan purchase history.
  const deleteSupplier = async (id: string) => {
    if ((stats[id]?.billCount || 0) > 0) {
      toast.error('This supplier has purchase bills and cannot be deleted')
      return false
    }
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      setSuppliers(prev => prev.filter(s => s.id !== id))
      toast.success('Supplier deleted')
      return true
    } catch (e: any) {
      toast.error('Could not delete supplier: ' + (e.message || 'unknown error'))
      return false
    }
  }

  const q = search.trim().toLowerCase()
  const filteredSuppliers = !q ? suppliers : suppliers.filter(s =>
    s.name?.toLowerCase().includes(q) ||
    s.phone?.includes(q) ||
    s.gstin?.toLowerCase().includes(q) ||
    s.email?.toLowerCase().includes(q)
  )

  const statsFor = (id: string): SupplierStats => stats[id] || EMPTY_STATS

  const totals = {
    supplierCount: suppliers.length,
    totalPurchased: Object.values(stats).reduce((s, v) => s + v.totalPurchased, 0),
    totalOutstanding: Object.values(stats).reduce((s, v) => s + v.outstanding, 0)
  }

  return {
    suppliers, filteredSuppliers, statsFor, totals, loading,
    search, setSearch,
    createSupplier, updateSupplier, deleteSupplier,
    refresh: () => { loadSuppliers(); loadStats() }
  }
}
