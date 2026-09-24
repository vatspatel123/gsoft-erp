import { useState, useEffect, useCallback } from 'react'

export interface CartLine {
  variantId: string
  familyId: string
  title: string
  size: string | null
  colour: string | null
  unitPrice: number
  mrp: number | null
  photo: string | null
  qty: number
}

const STORAGE_KEY = 'urmii_cart'

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {}
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(load)

  useEffect(() => save(lines), [lines])

  const addItem = useCallback((line: Omit<CartLine, 'qty'>, qty = 1) => {
    setLines(prev => {
      const existing = prev.find(l => l.variantId === line.variantId)
      if (existing) {
        return prev.map(l => l.variantId === line.variantId ? { ...l, qty: l.qty + qty } : l)
      }
      return [...prev, { ...line, qty }]
    })
  }, [])

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines(prev => qty <= 0
      ? prev.filter(l => l.variantId !== variantId)
      : prev.map(l => l.variantId === variantId ? { ...l, qty } : l))
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setLines(prev => prev.filter(l => l.variantId !== variantId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const count = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)

  return { lines, addItem, setQty, removeItem, clear, count, subtotal }
}
