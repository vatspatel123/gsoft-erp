import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { saveProductsToCache } from '../utils/offlineCache'

export interface Supplier {
  id: string
  name: string
  business_name: string
  phone: string
  email: string
  gstin: string
  address: string
  state: string
  city: string
  outstanding_balance: number
  total_purchased: number
  is_active: boolean
}

export interface PurchaseItem {
  id: string
  product: any | null
  productName: string
  design_no: string
  pcode: string
  size: string
  colour: string
  mrp: number | ''
  qty: number | ''
  batch_no: string
  unit_cost: number | ''
  gst_rate: number
  line_total: number
}

export interface PurchaseComplete {
  purchaseNo: string
  bill: any
  items: PurchaseItem[]
  supplier: Supplier | null
  netAmount: number
}

const EMPTY_ITEM = (): PurchaseItem => ({
  id: Math.random().toString(36).slice(2),
  product: null,
  productName: '',
  design_no: '',
  pcode: '',
  size: '',
  colour: '',
  mrp: '',
  qty: '',
  batch_no: '',
  unit_cost: '',
  gst_rate: 5,
  line_total: 0,
})

export function usePurchaseEntry() {
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // Supplier
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([])
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: '', business_name: '', phone: '', gstin: '',
    address: '', state: 'Gujarat', city: '', email: ''
  })

  // Bill fields
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('')
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'cheque' | 'bank'>('credit')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('pending')
  const [gstType, setGstType] = useState<'gst' | 'igst'>('gst')
  const [discountAmt, setDiscountAmt] = useState<number>(0)
  const [discountPct, setDiscountPct] = useState<number>(0)
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [freightAmt, setFreightAmt] = useState<number>(0)
  const [notes, setNotes] = useState('')

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([EMPTY_ITEM()])
  const [listOnWebsite, setListOnWebsite] = useState(true)

  // Loading / success
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [purchaseComplete, setPurchaseComplete] = useState<PurchaseComplete | null>(null)

  // History
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'paid' | 'pending'>('all')

  // Counter
  const [counter, setCounter] = useState(1)

  useEffect(() => {
    const stored = localStorage.getItem('purchase_counter')
    if (stored) setCounter(parseInt(stored, 10))
  }, [])

  // Search suppliers
  useEffect(() => {
    if (supplierQuery.trim().length < 2) {
      setSupplierResults([])
      setShowSupplierDropdown(false)
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .or(`name.ilike.%${supplierQuery}%,phone.ilike.%${supplierQuery}%,gstin.ilike.%${supplierQuery}%`)
        .limit(8)
      setSupplierResults(data || [])
      setShowSupplierDropdown(true)
    }, 300)
    return () => clearTimeout(t)
  }, [supplierQuery])

  // Fetch history when tab changes
  useEffect(() => {
    if (tab === 'history') fetchHistory()
  }, [tab, historyFilter])

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      let q = supabase
        .from('purchase_bills')
        .select(`*, suppliers(name,phone,gstin), purchase_items(id)`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (historyFilter !== 'all') {
        q = q.eq('payment_status', historyFilter)
      }

      const { data } = await q
      setHistory(data || [])
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => {
    const qty = typeof item.qty === 'number' ? item.qty : 0
    const cost = typeof item.unit_cost === 'number' ? item.unit_cost : 0
    return sum + qty * cost
  }, 0)

  const effectiveDiscount = discountMode === 'percent'
    ? subtotal * discountPct / 100
    : discountAmt

  const afterDiscount = subtotal - effectiveDiscount + freightAmt

  const totalGST = items.reduce((sum, item) => {
    const qty = typeof item.qty === 'number' ? item.qty : 0
    const cost = typeof item.unit_cost === 'number' ? item.unit_cost : 0
    const lineTotal = qty * cost
    return sum + lineTotal * (item.gst_rate / 100)
  }, 0)

  const preRound = afterDiscount + totalGST
  const roundOff = Math.round(preRound) - preRound
  const netAmount = Math.round(preRound)

  const cgst = gstType === 'gst' ? totalGST / 2 : 0
  const sgst = gstType === 'gst' ? totalGST / 2 : 0
  const igst = gstType === 'igst' ? totalGST : 0

  const totalUnits = items.reduce((sum, item) => {
    return sum + (typeof item.qty === 'number' ? item.qty : 0)
  }, 0)

  // ── Item operations ───────────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()])

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }

      // If product selected, auto-fill fields
      if (field === 'product' && value) {
        updated.productName = value.name || ''
        updated.design_no = value.design_no || ''
        updated.pcode = value.pcode || ''
        updated.size = value.size || ''
        updated.colour = value.colour || ''
        updated.mrp = value.mrp || ''
        updated.unit_cost = value.cost_price || ''
        updated.gst_rate = value.gst_rate || 5
        const c = typeof value.cost_price === 'number' ? value.cost_price : 0
        const q = typeof updated.qty === 'number' ? updated.qty : 0
        updated.line_total = q * c
      } else {
        const qty = typeof updated.qty === 'number' ? updated.qty : 0
        const cost = typeof updated.unit_cost === 'number' ? updated.unit_cost : 0
        updated.line_total = qty * cost
      }
      return updated
    }))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(item => item.id !== id) : prev)
  }

  const generateBatch = (id: string) => {
    updateItem(id, 'batch_no', Date.now().toString().slice(-6))
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSupplier(null)
    setSupplierQuery('')
    setSupplierInvoiceNo('')
    setSupplierInvoiceDate(new Date().toISOString().slice(0, 10))
    setPaymentMode('credit')
    setPaymentStatus('pending')
    setDiscountAmt(0)
    setDiscountPct(0)
    setFreightAmt(0)
    setNotes('')
    setItems([EMPTY_ITEM()])
  }

  // ── Save new supplier ─────────────────────────────────────────────────────
  const saveNewSupplier = async () => {
    const rawName = newSupplier.name.trim()
    const rawBusiness = newSupplier.business_name.trim()
    if (!rawName && !rawBusiness) { toast.error('Supplier name required'); return }
    
    const displayName = rawBusiness && rawName && rawBusiness !== rawName
      ? `${rawBusiness} (${rawName})`
      : (rawBusiness || rawName)

    const addressParts = [
      newSupplier.address.trim(),
      newSupplier.city.trim(),
      newSupplier.state.trim()
    ].filter(Boolean)

    const payload = {
      name: displayName,
      phone: newSupplier.phone.trim() || null,
      gstin: newSupplier.gstin.trim() || null,
      address: addressParts.join(', ') || null,
      email: newSupplier.email.trim() || null,
    }

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      if (data) {
        setSupplier(data)
        setShowNewSupplierForm(false)
        setNewSupplier({ name: '', business_name: '', phone: '', gstin: '', address: '', state: 'Gujarat', city: '', email: '' })
        toast.success('Supplier saved!')
      }
    } catch (err: any) {
      console.error('Error saving supplier:', err)
      toast.error('Failed to save supplier: ' + (err.message || 'Unknown error'))
    }
  }

  // ── Save purchase ─────────────────────────────────────────────────────────
  const savePurchase = async () => {
    const validItems = items.filter(i => {
      const qty = typeof i.qty === 'number' ? i.qty : 0
      const cost = typeof i.unit_cost === 'number' ? i.unit_cost : 0
      return qty > 0 && cost > 0 && (i.product || i.productName.trim())
    })
    if (validItems.length === 0) {
      toast.error('Add at least one item with qty and cost')
      return
    }

    setLoading(true)
    try {
      // 1. Resolve valid supplier_id in database to avoid foreign key violations
      let finalSupplierId: string | null = null
      if (supplier) {
        if (supplier.id) {
          const { data: checkSup } = await supabase
            .from('suppliers')
            .select('id')
            .eq('id', supplier.id)
            .maybeSingle()

          if (checkSup?.id) {
            finalSupplierId = checkSup.id
          }
        }

        // If supplier was not found in DB by id, try creating it or matching by phone/name
        if (!finalSupplierId && (supplier.name || supplier.business_name)) {
          const supName = supplier.name || supplier.business_name
          const { data: createdSup } = await supabase
            .from('suppliers')
            .insert({
              name: supName,
              phone: supplier.phone || null,
              gstin: supplier.gstin || null,
              address: supplier.address || null,
              email: supplier.email || null,
            })
            .select()
            .single()

          if (createdSup?.id) {
            finalSupplierId = createdSup.id
            setSupplier(createdSup)
          }
        }
      }

      const purchaseNo = 'PO-' +
        new Date().toISOString().slice(0, 10).replace(/-/g, '') +
        '-' + String(counter).padStart(4, '0')

      const { data: bill, error: billError } = await supabase
        .from('purchase_bills')
        .insert({
          purchase_no: purchaseNo,
          supplier_id: finalSupplierId,
          supplier_invoice_no: supplierInvoiceNo || null,
          supplier_invoice_date: supplierInvoiceDate || null,
          subtotal,
          discount_amount: effectiveDiscount,
          freight: freightAmt,
          gst_type: gstType,
          gst_amount: totalGST,
          round_off: roundOff,
          net_amount: netAmount,
          payment_mode: paymentMode,
          payment_status: paymentStatus,
          notes: notes || null,
        })
        .select()
        .single()

      if (billError) throw billError

      await supabase.from('purchase_items').insert(
        validItems.map(item => ({
          purchase_id: bill.id,
          product_id: item.product?.id || null,
          product_name: item.product?.name || item.productName,
          design_no: item.design_no || null,
          pcode: item.pcode || null,
          size: item.size || null,
          colour: item.colour || null,
          batch_no: item.batch_no || null,
          qty: typeof item.qty === 'number' ? item.qty : 0,
          unit_cost: typeof item.unit_cost === 'number' ? item.unit_cost : 0,
          mrp: typeof item.mrp === 'number' ? item.mrp : null,
          gst_rate: item.gst_rate,
          line_total: item.line_total,
        }))
      )

      // Update inventory and ensure barcodes exist for each item
      const processedItems = []
      for (const item of validItems) {
        const qty = typeof item.qty === 'number' ? item.qty : 0
        const cost = typeof item.unit_cost === 'number' ? item.unit_cost : 0
        const mrp = typeof item.mrp === 'number' ? item.mrp : (cost ? Math.round(cost * 1.4) : null)
        const unitPrice = typeof item.mrp === 'number' ? item.mrp : Math.round(cost * 1.3)

        if (item.product?.id) {
          const { data: prod } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.product.id)
            .single()

          const currentBarcode = prod?.barcode || item.batch_no || 'BC-' + Math.floor(100000 + Math.random() * 900000)
          const newStock = (prod?.stock_qty || 0) + qty

          const { data: updatedProd } = await supabase
            .from('products')
            .update({
              stock_qty: newStock,
              cost_price: cost,
              mrp: mrp ?? prod?.mrp,
              unit_price: prod?.unit_price || unitPrice,
              batch_no: item.batch_no || prod?.batch_no,
              barcode: currentBarcode,
            })
            .eq('id', item.product.id)
            .select()
            .single()

          processedItems.push({
            ...item,
            product: updatedProd || { ...item.product, stock_qty: newStock, barcode: currentBarcode, mrp, cost_price: cost }
          })
        } else if (item.productName.trim()) {
          const newSku = 'SKU-' + Date.now().toString().slice(-6)
          const generatedBarcode = item.batch_no || 'BC-' + Math.floor(100000 + Math.random() * 900000)
          
          const { data: newProd, error: prodErr } = await supabase
            .from('products')
            .insert({
              name: item.productName.trim(),
              sku: newSku,
              design_no: item.design_no || null,
              pcode: item.pcode || null,
              size: item.size || null,
              colour: item.colour || null,
              batch_no: item.batch_no || null,
              cost_price: cost,
              unit_price: unitPrice,
              mrp: mrp,
              stock_qty: qty,
              gst_rate: item.gst_rate,
              is_active: true,
              is_online: listOnWebsite,
              online_price: unitPrice,
              barcode: generatedBarcode,
            })
            .select()
            .single()

          if (!prodErr && newProd) {
            processedItems.push({
              ...item,
              product: newProd
            })
          } else {
            processedItems.push({
              ...item,
              product: {
                id: crypto.randomUUID(),
                name: item.productName.trim(),
                sku: newSku,
                barcode: generatedBarcode,
                mrp,
                stock_qty: qty,
                cost_price: cost
              }
            })
          }
        }
      }

      // Refresh product cache for offline and instant POS sync
      try {
        const { data: allProds } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
        if (allProds) {
          saveProductsToCache(allProds)
        }
      } catch (cacheErr) {
        console.warn('Product cache refresh warning:', cacheErr)
      }

      // Update supplier balance if credit
      if (finalSupplierId && paymentStatus === 'pending') {
        try {
          const { data: sup } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', finalSupplierId)
            .single()

          if (sup && 'outstanding_balance' in sup) {
            await supabase
              .from('suppliers')
              .update({
                outstanding_balance: (sup?.outstanding_balance || 0) + netAmount,
                total_purchased: (sup?.total_purchased || 0) + netAmount,
              })
              .eq('id', finalSupplierId)
          }
        } catch (supErr) {
          console.warn('Supplier balance update notice:', supErr)
        }
      }

      const newCounter = counter + 1
      setCounter(newCounter)
      localStorage.setItem('purchase_counter', String(newCounter))

      toast.success('Purchase saved! Direct stock updated.')
      setPurchaseComplete({ purchaseNo, bill, items: processedItems, supplier, netAmount })
      setShowSuccessModal(true)
      resetForm()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return {
    tab, setTab,
    supplier, setSupplier,
    supplierQuery, setSupplierQuery,
    supplierResults, showSupplierDropdown, setShowSupplierDropdown,
    showNewSupplierForm, setShowNewSupplierForm,
    newSupplier, setNewSupplier,
    saveNewSupplier,
    supplierInvoiceNo, setSupplierInvoiceNo,
    supplierInvoiceDate, setSupplierInvoiceDate,
    paymentMode, setPaymentMode,
    paymentStatus, setPaymentStatus,
    gstType, setGstType,
    discountAmt, setDiscountAmt,
    discountPct, setDiscountPct,
    discountMode, setDiscountMode,
    freightAmt, setFreightAmt,
    notes, setNotes,
    items, addItem, updateItem, removeItem, generateBatch,
    subtotal, effectiveDiscount, totalGST, cgst, sgst, igst,
    roundOff, netAmount, totalUnits,
    loading, savePurchase,
    showSuccessModal, setShowSuccessModal,
    purchaseComplete,
    history, historyLoading, historyFilter, setHistoryFilter, fetchHistory,
    counter,
    listOnWebsite, setListOnWebsite,
  }
}
