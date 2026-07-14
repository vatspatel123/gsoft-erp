import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

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

    const { data } = await query
    setProducts(data || [])
    setLoading(false)
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
    if (editId) {
      const { error } = await supabase.from('products').update(data).eq('id', editId)
      if (error) { toast.error(error.message); return false }
      toast.success('Product updated!')
    } else {
      const { error } = await supabase.from('products').insert(data)
      if (error) { toast.error(error.message); return false }
      toast.success('Product added!')
    }
    fetchProducts()
    return true
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
    fetchProducts, toggleStatus,
    deleteProduct, duplicateProduct,
    saveProduct, addCategory,
    bulkDelete, bulkDeactivate, bulkCategory,
    exportCSV
  }
}
