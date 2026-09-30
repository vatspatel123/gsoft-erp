import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { ProductForm } from '../inventory/ProductForm'
import { getCachedProducts, saveProductsToCache } from '../../utils/offlineCache'

interface Props {
  barcode?: string
  onClose: () => void
  onAdded: (product: any) => void
}

/** Add a product from the POS — the same form as Products — and put it on the bill. */
export function AddProductModal({ barcode, onClose, onAdded }: Props) {
  const [categories, setCategories] = useState<any[]>([])
  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []))
  }, [])

  const save = async (data: any) => {
    // The piece is on the counter, so there is at least one of it.
    const row = { ...data, id: crypto.randomUUID(), stock_qty: Math.max(1, data.stock_qty || 0) }
    const { data: saved, error } = await supabase.from('products').insert(row).select('*, categories(name)').single()
    if (error) { toast.error(error.message || 'Failed to add product'); return false }
    saveProductsToCache([saved, ...(getCachedProducts() || [])])
    toast.success('Product added to the bill')
    onAdded(saved)
    return true
  }

  const addCategory = async (name: string) => {
    const { data, error } = await supabase.from('categories').insert({ name }).select().single()
    if (error) { toast.error(error.message); return null }
    return data
  }

  return (
    <ProductForm
      product={barcode ? { barcode } : undefined}
      categories={categories}
      onSave={save}
      onAddCategory={addCategory}
      onClose={onClose}
    />
  )
}
