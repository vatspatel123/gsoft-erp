import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { savePendingSale, getCachedProducts, saveCustomerToCache, findCachedCustomer } from '../utils/offlineCache'
import { calculateCustomerTier, getTierInfo, type CustomerTier } from '../utils/customerTier'
import type { CreditNote } from './useCreditNotes'

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
  created_at?: string | null
  design_no?: string | null
  size?: string | null
  colour?: string | null
  mrp?: number | null
  batch_no?: string | null
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
  const [customerTier, setCustomerTier] = useState<CustomerTier>('New')
  const [activeCreditNotes, setActiveCreditNotes] = useState<CreditNote[]>([])
  const [appliedCreditNote, setAppliedCreditNote] = useState<CreditNote | null>(null)
  const [creditDueDays, setCreditDueDays] = useState<number>(5)
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [oldLotAlert, setOldLotAlert] = useState<{ scanned: Product; older: Product } | null>(null)

  const findOlderLot = useCallback(async (product: Product): Promise<Product | null> => {
    try {
      if (!product.is_active || product.stock_qty <= 0) return null

      if (navigator.onLine) {
        let query = supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .gt('stock_qty', 0)
          .neq('id', product.id)

        if (product.design_no) {
          query = query.eq('design_no', product.design_no)
        } else {
          query = query.eq('name', product.name)
        }

        if (product.size) {
          query = query.eq('size', product.size)
        }
        if (product.colour) {
          query = query.eq('colour', product.colour)
        }

        if (product.created_at) {
          query = query.lt('created_at', product.created_at)
        }

        const { data, error } = await query.order('created_at', { ascending: true }).limit(1)

        if (error) {
          console.error('Supabase query error finding older lot:', error)
          return null
        }

        if (data && data.length > 0) {
          return data[0] as Product
        }
      } else {
        const cached = getCachedProducts()
        if (cached) {
          const matches = cached.filter((p: any) => {
            if (p.id === product.id || !p.is_active || p.stock_qty <= 0) return false
            const sameIdentity = product.design_no ? p.design_no === product.design_no : p.name === product.name
            if (!sameIdentity) return false
            if (product.size && p.size !== product.size) return false
            if (product.colour && p.colour !== product.colour) return false
            if (product.created_at && p.created_at && p.created_at >= product.created_at) return false
            return true
          })

          if (matches.length > 0) {
            matches.sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''))
            return matches[0] as Product
          }
        }
      }
    } catch (err) {
      console.error('Error finding older lot:', err)
    }
    return null
  }, [])

  const addToCart = useCallback(async (product: Product, skipOldLotCheck = false) => {
    if (!product.is_active) {
      toast.error('Product is inactive')
      return
    }
    if (product.stock_qty <= 0) {
      toast.error('Out of stock')
      return
    }

    if (!skipOldLotCheck) {
      const olderProduct = await findOlderLot(product)
      if (olderProduct) {
        setOldLotAlert({ scanned: product, older: olderProduct })
        return
      }
    }

    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id)
      if (ex) {
        if (ex.qty >= product.stock_qty) {
          toast.error(`Only ${product.stock_qty} in stock`)
          return prev
        }
        const newQty = ex.qty + 1;
        const remainingStock = product.stock_qty - newQty;
        if (remainingStock <= product.low_stock_alert && remainingStock > 0) {
          toast(`Only ${remainingStock} left in stock!`, { icon: '⚠️' })
        }
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, qty: newQty, line_total: calcLineTotal(i.unit_price, newQty, i.discount_pct) }
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
  }, [findOlderLot])

  const confirmUseOlderLot = useCallback(() => {
    if (oldLotAlert) {
      const older = oldLotAlert.older
      setOldLotAlert(null)
      addToCart(older, true)
      toast.success(`Swapped to older lot (${older.batch_no || older.sku})`)
    }
  }, [oldLotAlert, addToCart])

  const confirmKeepScannedLot = useCallback(() => {
    if (oldLotAlert) {
      const scanned = oldLotAlert.scanned
      setOldLotAlert(null)
      addToCart(scanned, true)
    }
  }, [oldLotAlert, addToCart])

  const dismissOldLotAlert = useCallback(() => {
    setOldLotAlert(null)
  }, [])

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCart(p => p.filter(i => i.product.id !== id))
      return
    }
    setCart(p => {
      const existing = p.find(i => i.product.id === id)
      if (!existing) return p
      if (qty > existing.product.stock_qty) {
        toast.error(`Only ${existing.product.stock_qty} in stock`)
        return p
      }
      
      const remainingStock = existing.product.stock_qty - qty;
      if (remainingStock <= existing.product.low_stock_alert && qty > existing.qty && remainingStock > 0) {
        toast(`Only ${remainingStock} left in stock!`, { icon: '⚠️' })
      }
      
      return p.map(i =>
        i.product.id === id
          ? { ...i, qty, line_total: calcLineTotal(i.unit_price, qty, i.discount_pct) }
          : i
      )
    })
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

  const creditNoteDiscount = appliedCreditNote
    ? Math.min(appliedCreditNote.balance_amount, Math.max(0, subtotal + gstAmount - couponDiscount - loyaltyDiscount))
    : 0

  const totalDiscount = couponDiscount + loyaltyDiscount + creditNoteDiscount
  const netAmount = Math.max(0, subtotal + gstAmount - totalDiscount)

  const loadCustomerExtraInfo = useCallback(async (cust: any) => {
    if (!cust) return
    try {
      // 1. Calculate Tier from sales history
      let billsCount = 0
      let maxSingleBill = 0
      let yearlySpent = 0
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

      if (navigator.onLine && cust.id) {
        const { data: sales } = await supabase
          .from('sales')
          .select('net_amount, created_at')
          .eq('customer_id', cust.id)
          .eq('is_return', false)

        if (sales && sales.length > 0) {
          billsCount = sales.length
          maxSingleBill = Math.max(...sales.map(s => s.net_amount || 0))
          yearlySpent = sales
            .filter(s => s.created_at >= oneYearAgo)
            .reduce((sum, s) => sum + (s.net_amount || 0), 0)
        }

        // 2. Fetch Active Credit Notes
        const { data: cns } = await supabase
          .from('credit_notes')
          .select('*')
          .or(`customer_id.eq.${cust.id},customer_phone.eq.${cust.phone}`)
          .eq('status', 'active')
          .gt('balance_amount', 0)

        if (cns) setActiveCreditNotes(cns)
      } else {
        // Fallback for offline cache
        const localCNsStr = localStorage.getItem('gsoft_credit_notes_cache')
        if (localCNsStr) {
          const allCns = JSON.parse(localCNsStr)
          const matched = allCns.filter((c: any) =>
            (c.customer_id === cust.id || c.customer_phone === cust.phone) &&
            c.status === 'active' && c.balance_amount > 0
          )
          setActiveCreditNotes(matched)
        }
      }

      const calculatedTier = calculateCustomerTier({
        billsCount,
        maxSingleBill,
        yearlySpent,
        lifetimeSpent: cust.total_spent || 0
      })
      setCustomerTier(calculatedTier)
    } catch (e) {
      console.warn('Load customer tier notice:', e)
    }
  }, [])

  const searchCustomer = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10) return
    const cleanPhone = phone.trim()
    setCustomerNotFound(false)
    setSearchedPhone(cleanPhone)
    setAppliedCreditNote(null)

    // Check local cache first
    const cached = findCachedCustomer(cleanPhone)
    if (cached) {
      setCustomer(cached)
      loadCustomerExtraInfo(cached)
      toast.success(`${cached.name} · ${cached.loyalty_points || 0} pts`)
      return
    }

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', cleanPhone)
          .single()

        if (!error && data) {
          saveCustomerToCache(data)
          setCustomer(data)
          loadCustomerExtraInfo(data)
          toast.success(`${data.name} · ${data.loyalty_points} pts`)
          return
        }
      } catch (err) {
        console.warn('DB searchCustomer warning:', err)
      }
    }

    setCustomerNotFound(true)
  }, [loadCustomerExtraInfo])

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
    try {
      if (navigator.onLine) {
        const d = getISTDateString()
        const { count, error } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .like('invoice_no', `INV-${d}-%`)
        if (!error) {
          const seq = String((count || 0) + 1).padStart(4, '0')
          return `INV-${d}-${seq}`
        }
      }
    } catch (e) {
      console.warn('Network error generating invoice sequence:', e)
    }
    const d = getISTDateString()
    const randomSeq = String(Math.floor(Math.random() * 9000) + 1000)
    return `INV-${d}-${randomSeq}`
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
      if (paymentMode === 'credit') {
        saleRecord.credit_due_days = creditDueDays
        saleRecord.credit_due_date = creditDueDate
        saleRecord.credit_status = 'unpaid'
      }

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
        try {
          // Attempt RPC first
          const { error: rpcErr } = await supabase.rpc('decrement_stock', {
            p_id: item.product.id,
            qty: item.qty
          })
          if (rpcErr) throw rpcErr;
        } catch {
          // Fallback to update (Warning: race condition possible if high concurrency, but safe for small setups)
          const newStock = Math.max(0, item.product.stock_qty - item.qty);
          await supabase.from('products').update({ stock_qty: newStock }).eq('id', item.product.id);
        }
      }

      // Update local cache inventory
      try {
        const cachedStr = localStorage.getItem('gsoft_products_cache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          const updated = cached.data.map((cp: any) => {
            const bought = cart.find(i => i.product.id === cp.id)
            if (bought) {
              return { ...cp, stock_qty: Math.max(0, cp.stock_qty - bought.qty) }
            }
            return cp
          })
          localStorage.setItem('gsoft_products_cache', JSON.stringify({ ...cached, data: updated }))
        }
      } catch (e) {
        console.warn('Failed to update local inventory cache', e)
      }

      if (coupon) {
        try {
          await supabase
            .from('coupons')
            .update({ used_count: coupon.used_count + 1 })
            .eq('id', coupon.id)
        } catch {}
      }

      if (customer) {
        try {
          const earned = Math.floor(netAmount / 10)
          const newBal = customer.loyalty_points - loyaltyToRedeem + earned
          await supabase
            .from('customers')
            .update({
              loyalty_points: newBal,
              total_spent: customer.total_spent + netAmount
            })
            .eq('id', customer.id)
        } catch {}
      }

      // Fetch salesman name for bill display
      let salesmanName: string | null = null
      if (salesmanId) {
        try {
          const { data: salesman } = await supabase
            .from('users')
            .select('name')
            .eq('id', salesmanId)
            .single()
          salesmanName = salesman?.name || null
        } catch {}
      }

      // Deduct credit note if applied
      if (appliedCreditNote && creditNoteDiscount > 0) {
        try {
          const newBal = Math.max(0, appliedCreditNote.balance_amount - creditNoteDiscount)
          const newStatus = newBal === 0 ? 'redeemed' : 'active'
          if (navigator.onLine) {
            await supabase
              .from('credit_notes')
              .update({ balance_amount: newBal, status: newStatus })
              .eq('id', appliedCreditNote.id)
          }
          const localCNsStr = localStorage.getItem('gsoft_credit_notes_cache')
          if (localCNsStr) {
            const allCns = JSON.parse(localCNsStr)
            const updatedCns = allCns.map((c: any) =>
              c.id === appliedCreditNote.id ? { ...c, balance_amount: newBal, status: newStatus } : c
            )
            localStorage.setItem('gsoft_credit_notes_cache', JSON.stringify(updatedCns))
          }
        } catch (e) {
          console.warn('Credit note balance deduction notice:', e)
        }
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
        creditDueDays: paymentMode === 'credit' ? creditDueDays : undefined,
        creditDueDate: paymentMode === 'credit' ? creditDueDate : undefined,
        salesmanName,
        creditNoteDiscount,
        date: new Date().toLocaleString('en-IN')
      }

      setLastSale(saleData)
      toast.success(`✅ ${invoiceNo}`)
      return saleData
    } catch (err: any) {
      console.warn('Database sale completion notice, saving sale locally:', err)
      const offlineSale = {
        invoiceNo: 'INV-' + getISTDateString() + '-' + String(Math.floor(Math.random() * 9000) + 1000),
        cart, customer, subtotal,
        gstAmount, totalDiscount,
        netAmount, paymentMode,
        creditDueDays: paymentMode === 'credit' ? creditDueDays : undefined,
        creditDueDate: paymentMode === 'credit' ? creditDueDate : undefined,
        salesmanId, counterId: COUNTER_ID,
        creditNoteDiscount,
        date: new Date().toLocaleString('en-IN')
      }
      savePendingSale(offlineSale)
      setLastSale(offlineSale)
      toast.success('Bill saved! ✅', { duration: 4000 })
      return offlineSale
    } finally {
      setIsSaving(false)
    }
  }, [cart, customer, coupon, paymentMode, loyaltyToRedeem, subtotal, totalDiscount, netAmount, gstAmount, salesmanId, appliedCreditNote, creditNoteDiscount, creditDueDays, creditDueDate])

  const clearCart = useCallback(() => {
    setCart([])
    setCustomer(null)
    setCoupon(null)
    setCouponCode('')
    setLoyaltyToRedeem(0)
    setPaymentMode('cash')
    setCreditDueDays(5)
    const d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    setCreditDueDate(d.toISOString().slice(0, 10))
    setLastSale(null)
    setCustomerNotFound(false)
    setSearchedPhone('')
    setAppliedCreditNote(null)
    setActiveCreditNotes([])
    setCustomerTier('New')
  }, [])

  const applyCreditNote = useCallback((note: CreditNote) => {
    setAppliedCreditNote(note)
    toast.success(`Applied Credit Note ${note.credit_note_no}`)
  }, [])

  const removeCreditNote = useCallback(() => {
    setAppliedCreditNote(null)
  }, [])

  const skipCustomer = useCallback(() => {
    setCustomerNotFound(false)
    setSearchedPhone('')
  }, [])

  const addCustomer = useCallback(async (details: { name: string, email: string, date_of_birth: string }) => {
    setIsSaving(true)
    try {
      const newCustomer = {
        id: crypto.randomUUID(),
        name: details.name || 'Customer',
        phone: searchedPhone,
        email: details.email || null,
        date_of_birth: details.date_of_birth || null,
        loyalty_points: 0,
        total_spent: 0,
        referral_code: crypto.randomUUID().substring(0, 8),
        created_at: new Date().toISOString()
      }

      if (navigator.onLine) {
        try {
          const { data, error } = await supabase.from('customers').insert({
            id: newCustomer.id,
            name: newCustomer.name,
            phone: newCustomer.phone,
            email: newCustomer.email,
            date_of_birth: newCustomer.date_of_birth,
            loyalty_points: 0,
            total_spent: 0,
            referral_code: newCustomer.referral_code
          }).select().single()

          if (!error && data) {
            saveCustomerToCache(data)
            setCustomer(data)
            setCustomerNotFound(false)
            toast.success('Customer added! 0 pts earned on this sale')
            return
          }
        } catch (dbErr) {
          console.warn('DB customer insert failed, using local customer:', dbErr)
        }
      }

      saveCustomerToCache(newCustomer)
      setCustomer(newCustomer)
      setCustomerNotFound(false)
      toast.success('Customer added! 0 pts earned on this sale')
    } catch (e: any) {
      toast.error(e.message || 'Failed to add customer')
    } finally {
      setIsSaving(false)
    }
  }, [searchedPhone])

  return {
    cart, addToCart, updateQty, updateDiscount, removeFromCart,
    customer, setCustomer, onCustomerFound: setCustomer, removeCustomer: () => { setCustomer(null); setAppliedCreditNote(null); setActiveCreditNotes([]) }, searchCustomer, customerNotFound, searchedPhone, addCustomer, skipCustomer,
    customerTier,
    activeCreditNotes, appliedCreditNote, applyCreditNote, removeCreditNote, creditNoteDiscount,
    coupon, couponCode, setCouponCode, applyCoupon,
    removeCoupon: () => { setCoupon(null); setCouponCode('') },
    paymentMode, setPaymentMode,
    creditDueDays, setCreditDueDays,
    creditDueDate, setCreditDueDate,
    loyaltyToRedeem, setLoyaltyToRedeem, maxRedeemable,
    subtotal, gstAmount, couponDiscount, loyaltyDiscount, totalDiscount, netAmount,
    completeSale, clearCart, isSaving, lastSale,
    oldLotAlert, confirmUseOlderLot, confirmKeepScannedLot, dismissOldLotAlert
  }
}
