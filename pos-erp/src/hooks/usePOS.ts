import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CartItem, Product, Customer, Coupon, PaymentMode } from '../types'
import toast from 'react-hot-toast'

export function usePOS(counterId: string, salesmanId: string) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<string | null>(null)

  // ── CART OPERATIONS ──────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    if (!product.is_active) { toast.error('Product is inactive'); return }
    if (product.stock_qty <= 0) { toast.error('Out of stock'); return }

    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock_qty) {
          toast.error(`Only ${product.stock_qty} in stock`)
          return prev
        }
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, qty: i.qty + 1, line_total: calcLineTotal(i.unit_price, i.qty + 1, i.discount_pct) }
            : i
        )
      }
      return [...prev, {
        product,
        qty: 1,
        unit_price: product.unit_price,
        discount_pct: 0,
        line_total: product.unit_price
      }]
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return }
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, qty, line_total: calcLineTotal(i.unit_price, qty, i.discount_pct) }
        : i
    ))
  }, [])

  const updateDiscount = useCallback((productId: string, discount_pct: number) => {
    const pct = Math.min(Math.max(0, discount_pct), 100)
    setCart(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, discount_pct: pct, line_total: calcLineTotal(i.unit_price, i.qty, pct) }
        : i
    ))
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setCustomer(null)
    setCoupon(null)
    setCouponCode('')
    setLoyaltyPointsToRedeem(0)
    setPaymentMode('cash')
    setLastInvoice(null)
  }, [])

  // ── CALCULATIONS ─────────────────────────────────────────────
  const subtotal = cart.reduce((sum, i) => sum + i.line_total, 0)
  const gstAmount = cart.reduce((sum, i) => {
    const taxable = i.line_total
    return sum + (taxable * i.product.gst_rate) / 100
  }, 0)

  const couponDiscount = (() => {
    if (!coupon) return 0
    if (coupon.type === 'flat') return Math.min(coupon.value, subtotal)
    if (coupon.type === 'percentage') {
      const disc = (subtotal * coupon.value) / 100
      return coupon.max_discount_cap ? Math.min(disc, coupon.max_discount_cap) : disc
    }
    return 0
  })()

  // 1 point = ₹0.25 value
  const loyaltyDiscount = loyaltyPointsToRedeem * 0.25
  const maxRedeemablePoints = customer ? Math.min(customer.loyalty_points, Math.floor((subtotal * 0.2) / 0.25)) : 0

  const totalDiscount = couponDiscount + loyaltyDiscount
  const netAmount = Math.max(0, subtotal + gstAmount - totalDiscount)

  // ── CUSTOMER SEARCH ──────────────────────────────────────────
  const searchCustomer = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10) return
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single()
    if (error || !data) { toast.error('Customer not found'); return }
    setCustomer(data)
    toast.success(`Customer found: ${data.name} (${data.loyalty_points} pts)`)
  }, [])

  // ── COUPON VALIDATION ────────────────────────────────────────
  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_to', today)
      .single()

    if (error || !data) { toast.error('Invalid or expired coupon'); return }
    if (data.max_uses !== null && data.used_count >= data.max_uses) {
      toast.error('Coupon usage limit reached'); return
    }
    if (subtotal < data.min_order_value) {
      toast.error(`Minimum order ₹${data.min_order_value} required`); return
    }
    setCoupon(data)
    toast.success(`Coupon applied! Saving ₹${couponDiscount.toFixed(2)}`)
  }, [couponCode, subtotal, couponDiscount])

  const removeCoupon = useCallback(() => {
    setCoupon(null)
    setCouponCode('')
  }, [])

  // ── GENERATE INVOICE NUMBER ──────────────────────────────────
  const generateInvoiceNo = async (): Promise<string> => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .like('invoice_no', `INV-${dateStr}-%`)
    const seq = String((count || 0) + 1).padStart(4, '0')
    return `INV-${dateStr}-${seq}`
  }

  // ── SAVE SALE ─────────────────────────────────────────────────
  const completeSale = useCallback(async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setIsSaving(true)

    try {
      const invoiceNo = await generateInvoiceNo()

      // 1. Insert sale header
      const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .insert({
          invoice_no: invoiceNo,
          customer_id: customer?.id ?? null,
          salesman_id: salesmanId,
          counter_id: counterId,
          total_amount: subtotal,
          discount_amount: totalDiscount,
          coupon_code: coupon?.code ?? null,
          net_amount: netAmount,
          gst_amount: gstAmount,
          payment_mode: paymentMode,
          loyalty_points_used: loyaltyPointsToRedeem,
          is_return: false
        })
        .select()
        .single()

      if (saleErr || !sale) throw new Error(saleErr?.message || 'Failed to create sale')

      // 2. Insert sale items
      const saleItems = cart.map(i => ({
        sale_id: sale.id,
        product_id: i.product.id,
        barcode: i.product.barcode || i.product.sku,
        qty: i.qty,
        unit_price: i.unit_price,
        discount_pct: i.discount_pct,
        gst_rate: i.product.gst_rate,
        line_total: i.line_total
      }))

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
      if (itemsErr) throw new Error(itemsErr.message)

      // 3. Update stock quantities
      for (const item of cart) {
        await supabase.rpc('decrement_stock', { p_id: item.product.id, qty: item.qty })
      }

      // 4. Update coupon usage
      if (coupon) {
        await supabase
          .from('coupons')
          .update({ used_count: coupon.used_count + 1 })
          .eq('id', coupon.id)
      }

      // 5. Award loyalty points (1 point per ₹10 spent)
      if (customer) {
        const pointsEarned = Math.floor(netAmount / 10)
        const newBalance = customer.loyalty_points - loyaltyPointsToRedeem + pointsEarned
        await supabase.from('customers').update({
          loyalty_points: newBalance,
          total_spent: customer.total_spent + netAmount
        }).eq('id', customer.id)

        if (pointsEarned > 0) {
          await supabase.from('loyalty_transactions').insert({
            customer_id: customer.id,
            sale_id: sale.id,
            type: 'earn',
            points_delta: pointsEarned,
            balance_after: newBalance
          })
        }
      }

      setLastInvoice(invoiceNo)
      toast.success(`✅ Sale saved! Invoice: ${invoiceNo}`)
      return sale.id

    } catch (err: any) {
      toast.error(err.message || 'Sale failed')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [cart, customer, coupon, paymentMode, loyaltyPointsToRedeem, subtotal, totalDiscount, netAmount, gstAmount, counterId, salesmanId])

  return {
    // Cart state
    cart, addToCart, updateQty, updateDiscount, removeFromCart, clearCart,
    // Customer
    customer, setCustomer, searchCustomer,
    // Coupon
    coupon, couponCode, setCouponCode, applyCoupon, removeCoupon,
    // Payment
    paymentMode, setPaymentMode,
    // Loyalty
    loyaltyPointsToRedeem, setLoyaltyPointsToRedeem, maxRedeemablePoints,
    // Totals
    subtotal, gstAmount, couponDiscount, loyaltyDiscount, totalDiscount, netAmount,
    // Actions
    completeSale, clearCart,
    isSaving, lastInvoice
  }
}

function calcLineTotal(unitPrice: number, qty: number, discountPct: number) {
  return unitPrice * qty * (1 - discountPct / 100)
}
