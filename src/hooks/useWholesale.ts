import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { fmtDateTime } from '../utils/date'

export interface WholesaleCartItem {
  product: any
  qty: number
  unit_price: number   // wholesale_price used at billing time
  mrp: number
  discount_pct: number
  gst_rate: number
  taxable_amount: number
  gst_amount: number
  line_total: number
}

export type WholesalePaymentMode = 'cash' | 'upi' | 'credit' | 'cheque'
export type GstType = 'gst' | 'igst'   // gst = CGST+SGST, igst = IGST

function generateInvoiceNo(): string {
  const d = new Date()
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const seq = String(Math.floor(1000 + Math.random() * 9000))
  return `WS-${ymd}-${seq}`
}

function calcItem(item: Omit<WholesaleCartItem, 'taxable_amount' | 'gst_amount' | 'line_total'>): WholesaleCartItem {
  const base = item.qty * item.unit_price
  const discAmt = base * (item.discount_pct / 100)
  const taxable = base - discAmt
  const gstAmt = taxable * (item.gst_rate / 100)
  const lineTotal = taxable + gstAmt
  return { ...item, taxable_amount: taxable, gst_amount: gstAmt, line_total: lineTotal }
}

export function useWholesale() {
  const [cart, setCart] = useState<WholesaleCartItem[]>([])
  const [party, setParty] = useState<any | null>(null)
  const [gstType, setGstType] = useState<GstType>('gst')
  const [discountPct, setDiscountPct] = useState(0)
  const [freight, setFreight] = useState(0)
  const [paymentMode, setPaymentMode] = useState<WholesalePaymentMode>('credit')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)

  // ─── Derived totals ───────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const billDiscAmt = subtotal * (discountPct / 100)
  const afterDiscount = subtotal - billDiscAmt
  const itemGstTotal = cart.reduce((s, i) => {
    const taxable = i.qty * i.unit_price * (1 - i.discount_pct / 100)
    return s + taxable * (i.gst_rate / 100)
  }, 0)
  const gstAmount = itemGstTotal
  const rawNet = afterDiscount + gstAmount + freight
  const roundOff = Math.round(rawNet) - rawNet
  const netAmount = rawNet + roundOff

  // ─── Cart ops ─────────────────────────────────────────────────────────────
  const addToCart = (product: any) => {
    const price = Number(product.wholesale_price) || Number(product.unit_price) || 0
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id)
      if (idx >= 0) {
        const updated = [...prev]
        const item = { ...updated[idx], qty: updated[idx].qty + 1 }
        updated[idx] = calcItem(item)
        return updated
      }
      return [...prev, calcItem({
        product,
        qty: 1,
        unit_price: price,
        mrp: Number(product.mrp) || price,
        discount_pct: 0,
        gst_rate: Number(product.gst_rate) || 0,
      })]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId); return }
    setCart(prev => prev.map(i =>
      i.product.id === productId ? calcItem({ ...i, qty }) : i
    ))
  }

  const updatePrice = (productId: string, price: number) => {
    setCart(prev => prev.map(i =>
      i.product.id === productId ? calcItem({ ...i, unit_price: price }) : i
    ))
  }

  const updateItemDiscount = (productId: string, pct: number) => {
    setCart(prev => prev.map(i =>
      i.product.id === productId ? calcItem({ ...i, discount_pct: pct }) : i
    ))
  }

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setParty(null)
    setDiscountPct(0)
    setFreight(0)
    setPaymentMode('credit')
    setNotes('')
  }

  // ─── Complete sale ────────────────────────────────────────────────────────
  const completeSale = async (): Promise<any> => {
    if (cart.length === 0) { toast.error('Cart is empty'); return null }
    if (!party) { toast.error('Select a party/customer first'); return null }

    setIsSaving(true)
    try {
      const invoiceNo = generateInvoiceNo()

      // 1. Insert sale header
      const { data: sale, error: saleErr } = await supabase
        .from('wholesale_sales')
        .insert({
          invoice_no: invoiceNo,
          wholesale_customer_id: party.id,
          subtotal,
          discount_pct: discountPct,
          discount_amount: billDiscAmt,
          freight,
          gst_type: gstType,
          gst_amount: gstAmount,
          round_off: roundOff,
          net_amount: netAmount,
          payment_mode: paymentMode,
          payment_status: paymentMode === 'credit' ? 'pending' : 'paid',
          notes: notes.trim() || null,
        })
        .select()
        .single()

      if (saleErr || !sale) {
        toast.error('Error saving sale: ' + (saleErr?.message || 'Unknown'))
        return null
      }

      // 2. Insert sale items
      await supabase.from('wholesale_sale_items').insert(
        cart.map(i => ({
          wholesale_sale_id: sale.id,
          product_id: i.product.id,
          qty: i.qty,
          unit_price: i.unit_price,
          mrp: i.mrp,
          discount_pct: i.discount_pct,
          gst_rate: i.gst_rate,
          line_total: i.line_total,
        }))
      )

      // 3. Deduct stock
      for (const item of cart) {
        const { data: p } = await supabase
          .from('products')
          .select('stock_qty')
          .eq('id', item.product.id)
          .single()
        if (p) {
          await supabase
            .from('products')
            .update({ stock_qty: Math.max(0, p.stock_qty - item.qty) })
            .eq('id', item.product.id)
        }
      }

      // 4. Update party outstanding + total_business
      if (paymentMode === 'credit') {
        await supabase
          .from('wholesale_customers')
          .update({
            outstanding_balance: (party.outstanding_balance || 0) + netAmount,
            total_business: (party.total_business || 0) + netAmount,
          })
          .eq('id', party.id)
      } else {
        await supabase
          .from('wholesale_customers')
          .update({ total_business: (party.total_business || 0) + netAmount })
          .eq('id', party.id)
      }

      const saleData = {
        invoiceNo,
        date: fmtDateTime(new Date()),
        party,
        cart,
        subtotal,
        discountPct,
        billDiscAmt,
        freight,
        gstType,
        gstAmount,
        roundOff,
        netAmount,
        paymentMode,
        notes,
      }

      setLastSale(saleData)
      toast.success(`Invoice ${invoiceNo} saved!`)
      return saleData
    } catch (e: any) {
      toast.error('Error: ' + e.message)
      return null
    } finally {
      setIsSaving(false)
    }
  }

  return {
    cart, party, setParty,
    gstType, setGstType,
    discountPct, setDiscountPct,
    freight, setFreight,
    paymentMode, setPaymentMode,
    notes, setNotes,
    isSaving, lastSale, setLastSale,
    // derived
    subtotal, billDiscAmt, afterDiscount, gstAmount, roundOff, netAmount,
    // ops
    addToCart, updateQty, updatePrice, updateItemDiscount, removeItem, clearCart,
    completeSale,
  }
}
