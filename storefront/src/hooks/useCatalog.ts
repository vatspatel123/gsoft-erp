import { useState, useEffect, useMemo } from 'react'
import { getStorefrontProducts } from '../api/storefront'

export interface ProductVariant {
  id: string
  size: string | null
  colour: string | null
  stock_qty: number
  unit_price: number
  mrp: number | null
  online_price: number | null
  photo_url: string | null
  photos: string[] | null
}

export interface ProductFamily {
  familyId: string
  title: string
  category: string
  description: string
  tag: 'New' | 'Bestseller' | 'Sale'
  photos: string[]
  price: number
  was: number | null
  sizes: string[]
  colours: string[]
  isFeatured: boolean
  isBestseller: boolean
  variants: ProductVariant[]
}

function toFamilies(rows: any[]): ProductFamily[] {
  const groups = new Map<string, any[]>()
  for (const row of rows) {
    const key = row.design_no || row.id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  return Array.from(groups.entries()).map(([familyId, variants]) => {
    const first = variants[0]
    const price = Math.min(...variants.map(v => v.online_price ?? v.unit_price))
    const was = first.mrp && first.mrp > price ? Number(first.mrp) : null
    const isBestseller = variants.some(v => v.is_bestseller)
    const isFeatured = variants.some(v => v.is_featured)
    const hasDiscount = variants.some(v => (v.online_discount_pct ?? 0) > 0)
    const photos = Array.from(new Set(
      variants.flatMap(v => (v.photos && v.photos.length ? v.photos : v.photo_url ? [v.photo_url] : []))
    ))

    return {
      familyId,
      title: first.online_title || first.name,
      category: first.online_category || 'Uncategorised',
      description: first.online_description || '',
      tag: isBestseller ? 'Bestseller' : hasDiscount ? 'Sale' : 'New',
      photos,
      price,
      was,
      sizes: Array.from(new Set(variants.filter(v => v.stock_qty > 0).map(v => v.size).filter(Boolean))),
      colours: Array.from(new Set(variants.map(v => v.colour).filter(Boolean))),
      isFeatured,
      isBestseller,
      variants: variants.map(v => ({
        id: v.id,
        size: v.size,
        colour: v.colour,
        stock_qty: v.stock_qty,
        unit_price: v.unit_price,
        mrp: v.mrp,
        online_price: v.online_price,
        photo_url: v.photo_url,
        photos: v.photos
      }))
    }
  })
}

export function useCatalog() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getStorefrontProducts()
      .then(data => { if (!cancelled) setRows(data) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const families = useMemo(() => toFamilies(rows), [rows])
  const categories = useMemo(() => Array.from(new Set(families.map(f => f.category))), [families])
  const featured = useMemo(() => families.filter(f => f.isFeatured), [families])
  const bestsellers = useMemo(() => families.filter(f => f.isBestseller), [families])

  const getFamily = (familyId: string) => families.find(f => f.familyId === familyId)

  return { families, categories, featured, bestsellers, getFamily, loading, error }
}
