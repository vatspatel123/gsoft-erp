import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { getCachedProducts, saveProductsToCache } from '../utils/offlineCache'
import { useLiveRefresh } from './useLiveRefresh'

// stock_damage_log.type only accepts these four. The UI collects a free-text
// reason, so map it; anything unrecognised is recorded as generic damage.
function damageTypeFor(reason: string): 'damage' | 'loss' | 'theft' | 'expiry' {
  const r = (reason || '').toLowerCase()
  if (r.includes('theft') || r.includes('shrink')) return 'theft'
  if (r.includes('expir')) return 'expiry'
  if (r.includes('sample') || r.includes('display') || r.includes('lost') || r.includes('loss')) return 'loss'
  return 'damage'
}

export function useInventory() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [adjustments, setAdjustments] = useState<any[]>([])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(name)')
          .eq('is_active', true)
          .order('name')
        if (!error && data && data.length > 0) {
          setProducts(data)
          saveProductsToCache(data, { replace: true })
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.error('Error fetching inventory products, using cache:', e)
    }
    const cached = getCachedProducts() || []
    setProducts(cached.filter((p: any) => p.is_active !== false))
    setLoading(false)
  }

  const fetchAdjustments = async () => {
    try {
      const { data } = await supabase
        .from('stock_damage_log')
        .select(`
          *,
          products(name)
        `)
        .order('created_at', {
          ascending: false
        })
        .limit(10)
      setAdjustments(data || [])
    } catch (e) {
      console.error('Error fetching adjustments:', e)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchAdjustments()
  }, [])
  useLiveRefresh(['products'], fetchProducts)

  const adjustStock = async (
    productId: string,
    type: 'add' | 'remove' | 'set',
    qty: number,
    reason: string,
    notes: string
  ) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    let newQty = product.stock_qty
    if (type === 'add') newQty = product.stock_qty + qty
    else if (type === 'remove')
      newQty = Math.max(0, product.stock_qty - qty)
    else if (type === 'set') newQty = qty

    // Update local state immediately for instant UI feedback
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, stock_qty: newQty } : p
    ))

    // Update local cache
    try {
      const cachedStr = localStorage.getItem('gsoft_products_cache')
      if (cachedStr) {
        const cached = JSON.parse(cachedStr)
        const updatedData = (cached.data || cached.products || []).map((p: any) =>
          p.id === productId ? { ...p, stock_qty: newQty } : p
        )
        localStorage.setItem('gsoft_products_cache', JSON.stringify({
          ...cached,
          data: updatedData,
          products: updatedData,
          savedAt: Date.now()
        }))
      }
    } catch (e) {
      console.warn('Failed to update local product cache:', e)
    }

    try {
      if (navigator.onLine) {
        try {
          await supabase
            .from('products')
            .update({ stock_qty: newQty })
            .eq('id', productId)

          // The table stores a POSITIVE qty (CHECK qty > 0) plus a `type` limited
          // to damage/loss/theft/expiry. Direction lives in adjustment_type and in
          // qty_before/qty_after. Writing a signed `qty_change` — a column that does
          // not exist — silently rejected every row, so nothing was ever logged.
          const qtyChange =
            type === 'add'
              ? qty
              : type === 'remove'
                ? -qty
                : qty - product.stock_qty

          const { error: logError } = await supabase.from('stock_damage_log').insert({
            product_id: productId,
            qty: Math.abs(qtyChange) || 1,
            qty_before: product.stock_qty,
            qty_after: newQty,
            type: damageTypeFor(reason),
            reason: reason,
            notes: notes || null,
            adjustment_type: type
          })
          if (logError) throw logError
        } catch (dbErr) {
          console.warn('DB adjust stock warning, local cache already updated:', dbErr)
        }
      }

      toast.success('Stock updated!')
      fetchAdjustments()
    } catch (e) {
      console.error('Error adjusting stock:', e)
      toast.error('Failed to update stock')
    }
  }

  const quickAdjust = async (
    productId: string,
    change: number
  ) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const newQty = Math.max(0, product.stock_qty + change)

    // Update local state immediately for instant UI feedback
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, stock_qty: newQty } : p
    ))

    // Update local cache
    try {
      const cachedStr = localStorage.getItem('gsoft_products_cache')
      if (cachedStr) {
        const cached = JSON.parse(cachedStr)
        const updatedData = (cached.data || cached.products || []).map((p: any) =>
          p.id === productId ? { ...p, stock_qty: newQty } : p
        )
        localStorage.setItem('gsoft_products_cache', JSON.stringify({
          ...cached,
          data: updatedData,
          products: updatedData,
          savedAt: Date.now()
        }))
      }
    } catch (e) {
      console.warn('Failed to update local product cache:', e)
    }

    // Try syncing to DB
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('products')
          .update({ stock_qty: newQty })
          .eq('id', productId)
        if (error) throw error
      } catch (e) {
        console.warn('DB quick adjust failed, local cache updated:', e)
      }
    }

    toast.success(
      change > 0 ? '+' + change + ' added' : change + ' removed'
    )
  }

  const saveStockCount = async (
    counts: {
      productId: string
      physicalQty: number
      systemQty: number
    }[]
  ) => {
    let updated = 0
    let matched = 0

    try {
      for (const count of counts) {
        await supabase
          .from('products')
          .update({
            stock_qty: count.physicalQty
          })
          .eq('id', count.productId)

        await supabase.from('physical_stock_counts').insert({
          product_id: count.productId,
          system_qty: count.systemQty,
          physical_qty: count.physicalQty,
          counted_at: new Date().toISOString()
        })

        if (count.physicalQty === count.systemQty) matched++
        updated++
      }

      toast.success(
        updated +
          ' products updated. ' +
          matched +
          ' matched perfectly!'
      )
      fetchProducts()
    } catch (e) {
      console.error('Error saving stock count:', e)
      toast.error('Failed to save count')
    }
  }

  const filteredProducts = products
    .filter(p => {
      if (search) {
        const q = search.toLowerCase()
        return ['name', 'sku', 'barcode', 'design_no', 'pcode', 'batch_no']
          .some(f => p[f] != null && String(p[f]).toLowerCase().includes(q))
      }
      return true
    })
    .filter(p => {
      if (filter === 'healthy')
        return p.stock_qty > p.low_stock_alert
      if (filter === 'low')
        return p.stock_qty <= p.low_stock_alert && p.stock_qty > 0
      if (filter === 'out') return p.stock_qty === 0
      return true
    })

  const totalValue = products.reduce(
    (sum, p) => sum + p.unit_price * p.stock_qty,
    0
  )

  const lowStockProducts = products.filter(
    p => p.stock_qty <= p.low_stock_alert && p.stock_qty > 0
  )

  const outOfStockProducts = products.filter(p => p.stock_qty === 0)

  return {
    products: filteredProducts,
    allProducts: products,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    adjustments,
    totalValue,
    lowStockProducts,
    outOfStockProducts,
    adjustStock,
    quickAdjust,
    saveStockCount,
    fetchProducts
  }
}
