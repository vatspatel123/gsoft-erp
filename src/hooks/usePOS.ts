import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { savePendingSale } from '../utils/offlineCache'

// IST Timezone Helper - converts current time to IST date string (YYYYMMDD)
const getISTDateString = () => {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  const year = istNow.getUTCFullYear()
  const month = String(istNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istNow.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  unit_price: number
  gst_rate: number
  stock_qty: number
  low_stock_alert: number
  photo_url: string | null
  is_active: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  loyalty_points: number
  total_spent: number
  email?: string | null
  date_of_birth?: string | null
}

export interface CartItem {
  product: Product
  qty: number
  unit_price: number
  discount_pct: number
  line_total: number
}

export interface Coupon {
  id: string
  code: string
  type: 'flat' | 'percentage' | 'gift'
  value: number
  min_order_value: number
  max_discount_cap: number | null
  used_count: number
  max_uses: number | null
}

export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit'

function calcLineTotal(price: number, qty: number, disc: number) {
  return price * qty * (1 - disc / 100)
}

const COUNTER_ID = 'd7e9d1ad-47e8-49c0-9e5b-f3e8721d1e00'

export function usePOS(salesmanId: string | null = null) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [loyaltyToRedeem, setLoyaltyToRedeem] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [searchedPhone, setSearchedPhone] = useState('')

  const addToCart = useCallback((product: Product) => {
    if (!product.is_active) {
      toast.error('Product is inactive')
      return
    }
    if (product.stock_qty <= 0) {
      toast.error('Out of stock')
      return
    }
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id)
      if (ex) {
        if (ex.qty >= product.stock_qty) {
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

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCart(p => p.filter(i => i.product.id !== id))
      return
    }
    setCart(p => p.map(i =>
      i.product.id === id
        ? { ...i, qty, line_total: calcLineTotal(i.unit_price, qty, i.discount_pct) }
        : i
    ))
  }, [])

  const updateDiscount = useCallback((id: string, disc: number) => {
    const d = Math.min(Math.max(0, disc), 100)
    setCart(p => p.map(i =>
      i.product.id === id
        ? { ...i, discount_pct: d, line_total: calcLineTotal(i.unit_price, i.qty, d) }
        : i
    ))
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCart(p => p.filter(i => i.product.id !== id))
  }, [])

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0)
  const gstAmount = cart.reduce((s, i) => s + (i.line_total * i.product.gst_rate / 100), 0)

  const couponDiscount = (() => {
    if (!coupon) return 0
    if (coupon.type === 'flat') return Math.min(coupon.value, subtotal)
    if (coupon.type === 'percentage') {
      const d = subtotal * coupon.value / 100
      return coupon.max_discount_cap ? Math.min(d, coupon.max_discount_cap) : d
    }
    return 0
  })()

  const loyaltyDiscount = loyaltyToRedeem * 0.25
  const maxRedeemable = customer
    ? Math.min(customer.loyalty_points, Math.floor(subtotal * 0.2 / 0.25))
    : 0
  const totalDiscount = couponDiscount + loyaltyDiscount
  const netAmount = Math.max(0, subtotal + gstAmount - totalDiscount)

  const searchCustomer = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10) return
    setCustomerNotFound(false)
    setSearchedPhone(phone.trim())
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone.trim())
      .single()
    if (!data) {
      setCustomerNotFound(true)
      return
    }
    setCustomer(data)
    toast.success(`${data.name} · ${data.loyalty_points} pts`)
  }, [])

  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_to', today)
      .single()
    if (!data) {
      toast.error('Invalid or expired coupon')
      return
    }
    if (data.max_uses !== null && data.used_count >= data.max_uses) {
      toast.error('Coupon limit reached')
      return
    }
    if (subtotal < data.min_order_value) {
      toast.error(`Min order ₹${data.min_order_value}`)
      return
    }
    setCoupon(data)
    toast.success('Coupon applied!')
  }, [couponCode, subtotal])

  const generateInvoiceNo = async () => {
    const d = getISTDateString()
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .like('invoice_no', `INV-${d}-%`)
    const seq = String((count || 0) + 1).padStart(4, '0')
    return `INV-${d}-${seq}`
  }

  const completeSale = useCallback(async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return null
    }

    if (!customer || !customer.phone?.trim()) {
      toast.error('📱 Customer phone required!', { duration: 3000 })
      return null
    }

    if (!navigator.onLine) {
      const offlineSale = {
        invoiceNo: 'OFF-' + Date.now(),
        cart, customer, subtotal,
        gstAmount, totalDiscount,
        netAmount, paymentMode,
        salesmanId, counterId: COUNTER_ID,
        date: new Date().toLocaleString('en-IN')
      }
      savePendingSale(offlineSale)
      setLastSale(offlineSale)
      toast.success('Bill saved offline! Will sync when internet returns.', { duration: 4000 })
      return offlineSale
    }

    setIsSaving(true)
    try {
      const invoiceNo = await generateInvoiceNo()
      const saleRecord: Record<string, any> = {
          invoice_no: invoiceNo,
          customer_id: customer?.id ?? null,
          counter_id: COUNTER_ID,
          total_amount: subtotal,
          discount_amount: totalDiscount,
          coupon_code: coupon?.code ?? null,
          net_amount: netAmount,
          gst_amount: gstAmount,
          payment_mode: paymentMode,
          loyalty_points_used: loyaltyToRedeem,
          is_return: false
      }
      if (salesmanId) saleRecord.salesman_id = salesmanId

      const { data: sale, error } = await supabase
        .from('sales')
        .insert(saleRecord)
        .select()
        .single()

      if (error || !sale) throw new Error(error?.message || 'Sale failed')

      await supabase
        .from('sale_items')
        .insert(cart.map(i => ({
          sale_id: sale.id,
          product_id: i.product.id,
          barcode: i.product.barcode || i.product.sku,
          qty: i.qty,
          unit_price: i.unit_price,
          discount_pct: i.discount_pct,
          gst_rate: i.product.gst_rate,
          line_total: i.line_total
        })))

      for (const item of cart) {
        await supabase.rpc('decrement_stock', {
          p_id: item.product.id,
          qty: item.qty
        })
      }

      if (coupon) {
        await supabase
          .from('coupons')
          .update({ used_count: coupon.used_count + 1 })
          .eq('id', coupon.id)
      }

      if (customer) {
        const earned = Math.floor(netAmount / 10)
        const newBal = customer.loyalty_points - loyaltyToRedeem + earned
        await supabase
          .from('customers')
          .update({
            loyalty_points: newBal,
            total_spent: customer.total_spent + netAmount
          })
          .eq('id', customer.id)
      }

      // Fetch salesman name for bill display
      let salesmanName: string | null = null
      if (salesmanId) {
        const { data: salesman } = await supabase
          .from('users')
          .select('name')
          .eq('id', salesmanId)
          .single()
        salesmanName = salesman?.name || null
      }

      const saleData = {
        invoiceNo,
        saleId: sale.id,
        cart,
        customer,
        subtotal,
        gstAmount,
        totalDiscount,
        netAmount,
        paymentMode,
        salesmanName,
        date: new Date().toLocaleString('en-IN')
      }

      setLastSale(saleData)
      toast.success(`✅ ${invoiceNo}`)
      return saleData
    } catch (err: any) {
      toast.error(err.message || 'Sale failed')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [cart, customer, coupon, paymentMode, loyaltyToRedeem, subtotal, totalDiscount, netAmount, gstAmount, salesmanId])

  const clearCart = useCallback(() => {
    setCart([])
    setCustomer(null)
    setCoupon(null)
    setCouponCode('')
    setLoyaltyToRedeem(0)
    setPaymentMode('cash')
    setLastSale(null)
    setCustomerNotFound(false)
    setSearchedPhone('')
  }, [])

  const skipCustomer = useCallback(() => {
    setCustomerNotFound(false)
    setSearchedPhone('')
  }, [])

  const addCustomer = useCallback(async (details: { name: string, email: string, date_of_birth: string }) => {
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('customers').insert({
        name: details.name || 'Customer',
        phone: searchedPhone,
        email: details.email || null,
        date_of_birth: details.date_of_birth || null,
        loyalty_points: 0,
        total_spent: 0,
        referral_code: crypto.randomUUID().substring(0, 8)
      }).select().single()
      
      if (error) throw new Error(error.message)
      setCustomer(data)
      setCustomerNotFound(false)
      toast.success('Customer added! 0 pts earned on this sale')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }, [searchedPhone])

  return {
    cart, addToCart, updateQty, updateDiscount, removeFromCart,
    customer, setCustomer, onCustomerFound: setCustomer, removeCustomer: () => setCustomer(null), searchCustomer, customerNotFound, searchedPhone, addCustomer, skipCustomer,
    coupon, couponCode, setCouponCode, applyCoupon,
    removeCoupon: () => { setCoupon(null); setCouponCode('') },
    paymentMode, setPaymentMode,
    loyaltyToRedeem, setLoyaltyToRedeem, maxRedeemable,
    subtotal, gstAmount, couponDiscount, loyaltyDiscount, totalDiscount, netAmount,
    completeSale, clearCart, isSaving, lastSale
  }
}
