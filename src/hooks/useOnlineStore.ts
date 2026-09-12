import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedProducts, saveProductsToCache } from '../utils/offlineCache'
import toast from 'react-hot-toast'

export interface OnlineProduct {
  id: string
  name: string
  sku: string
  barcode?: string | null
  design_no?: string | null
  pcode?: string | null
  size?: string | null
  colour?: string | null
  unit_price: number
  cost_price?: number | null
  mrp?: number | null
  stock_qty: number
  gst_rate: number
  photo_url?: string | null
  photos?: string[] | null
  category_id?: string | null
  is_active: boolean
  
  // E-commerce fields
  is_online?: boolean
  online_price?: number | null
  online_discount_pct?: number | null
  online_title?: string | null
  online_description?: string | null
  online_category?: string | null
  is_featured?: boolean
  is_bestseller?: boolean
  tags?: string | null
}

const LOCAL_ONLINE_KEY = 'gsoft_online_overrides_cache'

export function useOnlineStore() {
  const [products, setProducts] = useState<OnlineProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'draft' | 'featured' | 'bestseller' | 'out_of_stock'>('all')

  const getOverrides = (): Record<string, Partial<OnlineProduct>> => {
    try {
      const stored = localStorage.getItem(LOCAL_ONLINE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  const saveOverride = (id: string, updates: Partial<OnlineProduct>) => {
    try {
      const current = getOverrides()
      current[id] = { ...(current[id] || {}), ...updates }
      localStorage.setItem(LOCAL_ONLINE_KEY, JSON.stringify(current))
    } catch {}
  }

  const loadProducts = useCallback(async () => {
    setLoading(true)
    let fetched: any[] = []
    const overrides = getOverrides()

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (!error && data) {
          fetched = data
          saveProductsToCache(data)
        }
      } catch (e) {
        console.warn('DB load notice in useOnlineStore:', e)
      }
    }

    if (fetched.length === 0) {
      fetched = getCachedProducts() || []
    }

    // Merge overrides
    const merged = fetched.map(p => {
      const o = overrides[p.id] || {}
      return {
        ...p,
        is_online: o.is_online !== undefined ? o.is_online : !!p.is_online,
        online_price: o.online_price !== undefined ? o.online_price : (p.online_price ?? p.mrp ?? p.unit_price),
        online_discount_pct: o.online_discount_pct !== undefined ? o.online_discount_pct : (p.online_discount_pct ?? 0),
        online_title: o.online_title !== undefined ? o.online_title : (p.online_title || p.name),
        online_description: o.online_description !== undefined ? o.online_description : (p.online_description || ''),
        online_category: o.online_category !== undefined ? o.online_category : (p.online_category || ''),
        is_featured: o.is_featured !== undefined ? o.is_featured : !!p.is_featured,
        is_bestseller: o.is_bestseller !== undefined ? o.is_bestseller : !!p.is_bestseller,
        tags: o.tags !== undefined ? o.tags : (p.tags || ''),
        photos: o.photos !== undefined ? o.photos : (p.photos || (p.photo_url ? [p.photo_url] : []))
      }
    })

    setProducts(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const toggleOnlineStatus = async (id: string, nextStatus?: boolean) => {
    const target = products.find(p => p.id === id)
    if (!target) return
    const newOnline = nextStatus !== undefined ? nextStatus : !target.is_online

    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_online: newOnline } : p))
    saveOverride(id, { is_online: newOnline })

    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update({ is_online: newOnline })
          .eq('id', id)
      } catch (err) {
        console.warn('DB update notice for online status:', err)
      }
    }

    toast.success(newOnline ? 'Published to website! 🛍️' : 'Moved to draft (In-store only)')
  }

  const toggleFeatured = async (id: string) => {
    const target = products.find(p => p.id === id)
    if (!target) return
    const newFeatured = !target.is_featured

    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_featured: newFeatured } : p))
    saveOverride(id, { is_featured: newFeatured })

    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update({ is_featured: newFeatured })
          .eq('id', id)
      } catch (err) {
        console.warn('DB update notice for featured flag:', err)
      }
    }

    toast.success(newFeatured ? 'Marked as Featured on Homepage ⭐' : 'Removed from Featured')
  }

  const toggleBestseller = async (id: string) => {
    const target = products.find(p => p.id === id)
    if (!target) return
    const newBest = !target.is_bestseller

    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_bestseller: newBest } : p))
    saveOverride(id, { is_bestseller: newBest })

    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update({ is_bestseller: newBest })
          .eq('id', id)
      } catch (err) {
        console.warn('DB update notice for bestseller flag:', err)
      }
    }

    toast.success(newBest ? 'Marked as Bestseller 🔥' : 'Removed from Bestsellers')
  }

  const updateOnlineDetails = async (id: string, updates: Partial<OnlineProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    saveOverride(id, updates)

    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update(updates)
          .eq('id', id)
      } catch (err) {
        console.warn('DB update notice for online details:', err)
      }
    }

    toast.success('Listing details updated! ✅')
  }

  const bulkPublish = async (ids: string[], isOnline: boolean) => {
    if (ids.length === 0) return
    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, is_online: isOnline } : p))
    ids.forEach(id => saveOverride(id, { is_online: isOnline }))

    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update({ is_online: isOnline })
          .in('id', ids)
      } catch (err) {
        console.warn('DB bulk update notice:', err)
      }
    }

    toast.success(isOnline ? `Published ${ids.length} products to website! 🛍️` : `Unpublished ${ids.length} products from website`)
  }

  // Filtered products
  const filteredProducts = products.filter(p => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.online_title && p.online_title.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.design_no && p.design_no.toLowerCase().includes(q)) ||
      (p.tags && p.tags.toLowerCase().includes(q))

    const matchesCat = categoryFilter === 'all' ||
      p.online_category === categoryFilter ||
      p.category_id === categoryFilter

    let matchesStatus = true
    if (statusFilter === 'online') matchesStatus = !!p.is_online
    else if (statusFilter === 'draft') matchesStatus = !p.is_online
    else if (statusFilter === 'featured') matchesStatus = !!p.is_featured
    else if (statusFilter === 'bestseller') matchesStatus = !!p.is_bestseller
    else if (statusFilter === 'out_of_stock') matchesStatus = p.stock_qty <= 0

    return matchesSearch && matchesCat && matchesStatus
  })

  // Stats
  const stats = {
    total: products.length,
    online: products.filter(p => p.is_online).length,
    draft: products.filter(p => !p.is_online).length,
    featured: products.filter(p => p.is_featured).length,
    bestseller: products.filter(p => p.is_bestseller).length,
    outOfStock: products.filter(p => p.is_online && p.stock_qty <= 0).length,
  }

  return {
    products: filteredProducts,
    allProducts: products,
    loading,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    stats,
    loadProducts,
    toggleOnlineStatus,
    toggleFeatured,
    toggleBestseller,
    updateOnlineDetails,
    bulkPublish
  }
}
