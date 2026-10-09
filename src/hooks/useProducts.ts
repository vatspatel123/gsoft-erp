import { useState, useCallback, useEffect, useRef } from 'react'
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
  // Typing fires one search per key; the server answers out of order (a broad
  // "2" took 4 s, "26335" 3 s), so only the newest request may fill the list.
  const lastReq = useRef(0)
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchProducts = useCallback(async () => {
    const req = ++lastReq.current
    setLoading(true)
    try {
      let query = supabase
        .from('products')
        .select(`*, categories(name)`)

      if (term) {
        const q = term.replace(/[",()]/g, ' ')
        query = query.or(
          ['name', 'sku', 'barcode', 'design_no', 'pcode', 'batch_no'].map(f => `${f}.ilike."%${q}%"`).join(',')
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
      if (req !== lastReq.current) return
      if (error) throw error
      // An empty answer is the answer ("no match"), not a reason to show the old cache.
      setProducts(data || [])
      if (data?.length) {
        // Only a query with no filters represents the full catalogue.
        saveProductsToCache(data, {
          replace: !term && !categoryFilter && statusFilter === 'all',
        })
      }
    } catch (err) {
      if (req !== lastReq.current) return
      console.warn('DB fetch failed, falling back to local product cache:', err)
      const cached = getCachedProducts()
      if (cached) setProducts(cached)
    } finally {
      if (req === lastReq.current) setLoading(false)
    }
  }, [term, categoryFilter, statusFilter, sortBy])

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

  // A refusal is reported, never shown as done. Deleting a product that is on a
  // bill is refused by the database (23503): it has history, so deactivate it.
  const failed = (error: any, what: string) => {
    if (!error) return false
    toast.error(error.code === '23503'
      ? 'Some of these products are on bills, so they can\'t be deleted — deactivate them instead'
      : `${what}: ${error.message}`, { duration: 6000 })
    return true
  }

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !current })
      .eq('id', id)
    if (failed(error, 'Not changed')) return
    fetchProducts()
    toast.success(!current ? 'Product activated' : 'Product deactivated')
  }

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (failed(error, 'Not deleted')) return
    fetchProducts()
    toast.success('Product deleted')
  }

  const bulkDelete = async (ids: string[]) => {
    const { error } = await supabase.from('products').delete().in('id', ids)
    if (failed(error, 'Not deleted')) return
    fetchProducts()
    toast.success(`${ids.length} products deleted`)
  }

  const bulkDeactivate = async (ids: string[]) => {
    const { error } = await supabase.from('products').update({ is_active: false }).in('id', ids)
    if (failed(error, 'Not deactivated')) return
    fetchProducts()
    toast.success(`${ids.length} products deactivated`)
  }

  const bulkCategory = async (ids: string[], categoryId: string) => {
    const { error } = await supabase.from('products').update({ category_id: categoryId }).in('id', ids)
    if (failed(error, 'Category not changed')) return
    fetchProducts()
    toast.success(`Category updated for ${ids.length} products`)
  }

  const duplicateProduct = async (product: any) => {
    const { id, created_at, updated_at, categories: _c, ...rest } = product
    const { error } = await supabase.from('products').insert({
      ...rest,
      name: rest.name + ' (Copy)',
      sku: 'SKU-' + Date.now().toString().slice(-6),
      // Barcodes are unique: copying it made every duplicate fail. The copy gets
      // its own barcode when edited.
      barcode: null,
      serial_barcode: null,
      stock_qty: 0
    })
    if (failed(error, 'Not duplicated')) return
    fetchProducts()
    toast.success('Product duplicated — give the copy its own barcode')
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
