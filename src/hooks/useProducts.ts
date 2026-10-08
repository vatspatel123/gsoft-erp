import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { getCachedProducts, saveProductsToCache } from '../utils/offlineCache'
import { useLiveRefresh } from './useLiveRefresh'

export function useProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('products')
        .select(`*, categories(name)`)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`
        )
      }
      if (categoryFilter) {
        query = query.eq('category_id', categoryFilter)
      }
      if (statusFilter !== 'all') {
        query = query.eq('is_active', statusFilter === 'active')
      }

      switch (sortBy) {
        case 'price':
          query = query.order('unit_price', { ascending: true })
          break
        case 'stock':
          query = query.order('stock_qty', { ascending: true })
          break
        case 'latest':
          query = query.order('created_at', { ascending: false })
          break
        default:
          query = query.order('name')
      }

      const { data, error } = await query
      if (error) throw error
      if (data && data.length > 0) {
        setProducts(data)
        // Only a query with no filters represents the full catalogue.
        saveProductsToCache(data, {
          replace: !search && !categoryFilter && statusFilter === 'all',
        })
      } else {
        const cached = getCachedProducts()
        setProducts(cached || data || [])
      }
    } catch (err) {
      console.warn('DB fetch failed, falling back to local product cache:', err)
      const cached = getCachedProducts()
      if (cached) setProducts(cached)
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, statusFilter, sortBy])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    setCategories(data || [])
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])
  useLiveRefresh(['products'], fetchProducts)

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase
      .from('products')
      .update({ is_active: !current })
      .eq('id', id)
    fetchProducts()
    toast.success(!current ? 'Product activated' : 'Product deactivated')
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
    toast.success('Product deleted')
  }

  const bulkDelete = async (ids: string[]) => {
    await supabase.from('products').delete().in('id', ids)
    fetchProducts()
    toast.success(`${ids.length} products deleted`)
  }

  const bulkDeactivate = async (ids: string[]) => {
    await supabase.from('products').update({ is_active: false }).in('id', ids)
    fetchProducts()
    toast.success(`${ids.length} products deactivated`)
  }

  const bulkCategory = async (ids: string[], categoryId: string) => {
    await supabase.from('products').update({ category_id: categoryId }).in('id', ids)
    fetchProducts()
    toast.success(`Category updated for ${ids.length} products`)
  }

  const duplicateProduct = async (product: any) => {
    const { id, created_at, updated_at, categories: _c, ...rest } = product
    await supabase.from('products').insert({
      ...rest,
      name: rest.name + ' (Copy)',
      sku: 'SKU-' + Date.now().toString().slice(-6),
      stock_qty: 0
    })
    fetchProducts()
    toast.success('Product duplicated')
  }

  const saveProduct = async (data: any, editId?: string) => {
    try {
      if (editId) {
        if (navigator.onLine) {
          const { error } = await supabase.from('products').update(data).eq('id', editId)
          if (error) {
            toast.error(error.message || 'Failed to update product')
            return false
          }
        }
        const cached = getCachedProducts() || []
        const updated = cached.map(p => p.id === editId ? { ...p, ...data } : p)
        saveProductsToCache(updated)
        setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...data } : p))
        toast.success('Product updated!')
      } else {
        const newProduct = { ...data, id: data.id || crypto.randomUUID() }
        if (navigator.onLine) {
          const { error } = await supabase.from('products').insert(newProduct)
          if (error) {
            toast.error(error.message || 'Failed to add product')
            return false
          }
        }
        const cached = getCachedProducts() || []
        saveProductsToCache([newProduct, ...cached])
        setProducts(prev => [newProduct, ...prev])
        toast.success('Product added!')
      }
      fetchProducts()
      return true
    } catch (err: any) {
      console.warn('Network error saving product, updating local cache:', err)
      if (editId) {
        const cached = getCachedProducts() || []
        const updated = cached.map(p => p.id === editId ? { ...p, ...data } : p)
        saveProductsToCache(updated)
        setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...data } : p))
      } else {
        const newProduct = { ...data, id: data.id || crypto.randomUUID() }
        const cached = getCachedProducts() || []
        saveProductsToCache([newProduct, ...cached])
        setProducts(prev => [newProduct, ...prev])
      }
      fetchProducts()
      toast.success('Product saved!')
      return true
    }
  }

  const addCategory = async (name: string) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
      .select()
      .single()
    if (error) { toast.error(error.message); return null }
    fetchCategories()
    return data
  }

  const exportCSV = () => {
    if (products.length === 0) { toast.error('No products to export'); return }
    const headers = ['Name', 'SKU', 'Barcode', 'Price', 'Cost', 'GST%', 'Stock', 'Low Alert', 'Category', 'Status']
    const rows = products.map(p => [
      p.name, p.sku, p.barcode || '', p.unit_price, p.cost_price || '',
      p.gst_rate, p.stock_qty, p.low_stock_alert,
      p.categories?.name || '', p.is_active ? 'Active' : 'Inactive'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  return {
    products, categories, loading,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    sortBy, setSortBy,
    fetchProducts, loadProducts: fetchProducts, toggleStatus,
    deleteProduct, duplicateProduct,
    saveProduct, addCategory,
    bulkDelete, bulkDeactivate, bulkCategory,
    exportCSV
  }
}
