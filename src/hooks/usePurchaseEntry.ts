import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { saveProductsToCache } from '../utils/offlineCache'
import { useLiveRefresh } from './useLiveRefresh'

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
  barcode: string
  unit_cost: number | ''
  gst_rate: number
  wholesale_price: number | ''
  online_price: number | ''
  line_total: number
  // Set when a row was copied from another, so the UI can show them as one design
  // in several colours.
  groupId?: string
}

export interface PurchaseComplete {
  purchaseNo: string
  bill: any
  items: PurchaseItem[]
  supplier: Supplier | null
  netAmount: number
}

// Barcodes must be numeric to stay scannable and to satisfy isValidBarcode (6-13 digits).
const makeBarcode = () =>
  Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0')

// The shop numbers its stock in sequence (…46091, 46092). New rows carry on from
// the highest such code: short numeric barcodes only, so a stray long or random
// code can't throw the sequence off.
const isSeqCode = (c?: string) => /^\d{1,7}$/.test(String(c || '').trim())
const nextCode = (last: number, rows: { barcode?: string }[]) =>
  String(Math.max(last, ...rows.filter(r => isSeqCode(r.barcode)).map(r => Number(r.barcode))) + 1)

const EMPTY_ITEM = (barcode = makeBarcode()): PurchaseItem => ({
  id: Math.random().toString(36).slice(2),
  product: null,
  productName: '',
  design_no: '',
  pcode: '',
  size: '',
  colour: '',
  mrp: '',
  qty: 1,      // one piece per colour/size is the norm; an empty qty silently counted as 0
  barcode,
  unit_cost: '',
  gst_rate: 5,
  wholesale_price: '',
  online_price: '',
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
  // Highest sequence barcode already in stock — see nextCode.
  const lastCode = useRef(0)
  const loadLastCode = async () => {
    const { data } = await supabase.from('products').select('barcode').not('barcode', 'is', null)
    lastCode.current = Math.max(0, ...(data || []).filter(r => isSeqCode(r.barcode)).map(r => Number(r.barcode)))
    // Rows made before the number was known get theirs now, in order.
    setItems(prev => prev.reduce<PurchaseItem[]>((out, r) =>
      [...out, isSeqCode(r.barcode) || r.product ? r : { ...r, barcode: nextCode(lastCode.current, out) }], []))
  }
  useEffect(() => { void loadLastCode() }, [])
  // Default false: the "Also list on website" control was removed from Purchase Entry,
  // so purchased items must not silently auto-publish to the online catalogue.
  const [listOnWebsite, setListOnWebsite] = useState(false)

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
  useLiveRefresh(['purchase_bills'], () => { if (tab === 'history') fetchHistory() })

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

  const effectiveDiscount = Math.min(subtotal, discountMode === 'percent'
    ? subtotal * discountPct / 100
    : discountAmt)

  const afterDiscount = subtotal - effectiveDiscount + freightAmt

  // GST is on what the goods actually cost after the supplier's discount, not on
  // the list total. The discount is shared across lines in proportion to value.
  const afterDiscountShare = subtotal > 0 ? (subtotal - effectiveDiscount) / subtotal : 0
  const totalGST = items.reduce((sum, item) => {
    const qty = typeof item.qty === 'number' ? item.qty : 0
    const cost = typeof item.unit_cost === 'number' ? item.unit_cost : 0
    return sum + qty * cost * (item.gst_rate / 100)
  }, 0) * afterDiscountShare

  const preRound = afterDiscount + totalGST
  const roundOff = Math.round(preRound) - preRound
  const netAmount = Math.round(preRound)

  const cgst = gstType === 'gst' ? totalGST / 2 : 0
  const sgst = gstType === 'gst' ? totalGST / 2 : 0
  const igst = gstType === 'igst' ? totalGST : 0

  const totalUnits = items.reduce((sum, item) => {
    return sum + (typeof item.qty === 'number' ? item.qty : 0)
  }, 0)

  // A row with a product on it but no qty (or no cost) — shown in red, and saving waits for it.
  const isStarted = (i: PurchaseItem) => !!(i.product || i.productName.trim())
  const missingQty = (i: PurchaseItem) => isStarted(i) && !(typeof i.qty === 'number' && i.qty > 0)
  const missingCost = (i: PurchaseItem) => isStarted(i) && !(typeof i.unit_cost === 'number' && i.unit_cost > 0)
  const emptyQtyCount = items.filter(missingQty).length
  const fillEmptyQty = () => setItems(prev => prev.map(i => {
    if (!missingQty(i)) return i
    const cost = typeof i.unit_cost === 'number' ? i.unit_cost : 0
    return { ...i, qty: 1, line_total: cost }
  }))

  // ── Item operations ───────────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM(nextCode(lastCode.current, prev))])

  // Copy a whole colour set to another size. Every row sharing this groupId is cloned
  // with the new size, keeping colour, qty, MRP, cost and GST. Batch is cleared because
  // it identifies a physical lot. The clones form their own group.
  const duplicateGroupAsSize = (groupId: string, newSize: string) => {
    if (!groupId || !newSize) return
    setItems(prev => {
      const members = prev.filter(i => i.groupId === groupId)
      if (members.length === 0) return prev
      const newGroup = Math.random().toString(36).slice(2)
      const clones: PurchaseItem[] = members.reduce<PurchaseItem[]>((out, m) => [...out, {
        ...m,
        id: Math.random().toString(36).slice(2),
        groupId: newGroup,
        size: newSize,
        // Each variant needs its own barcode, never the source row's.
        barcode: nextCode(lastCode.current, [...prev, ...out])
      }], [])
      const lastIdx = prev.map(i => i.groupId).lastIndexOf(groupId)
      return [...prev.slice(0, lastIdx + 1), ...clones, ...prev.slice(lastIdx + 1)]
    })
    toast.success(`${newSize} set added`)
  }

  // Copy a row directly below itself. Everything carries over except colour and
  // batch — colour is the thing being changed, and batch identifies a physical lot
  // so it must not be duplicated.
  const duplicateItem = (id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id)
      if (idx === -1) return prev
      const src = prev[idx]
      const groupId = src.groupId || Math.random().toString(36).slice(2)
      const copy: PurchaseItem = {
        ...src,
        id: Math.random().toString(36).slice(2),
        groupId,
        colour: '',
        barcode: nextCode(lastCode.current, prev)
      }
      const tagged = prev.map(i => (i.id === id ? { ...i, groupId } : i))
      return [...tagged.slice(0, idx + 1), copy, ...tagged.slice(idx + 1)]
    })
  }

  const updateItem = (id: string, field: keyof PurchaseItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }

      // Auto-fill from the chosen product, but only where the row is still empty.
      // Previously each field was overwritten with `value.X || ''`, so selecting a
      // product that had no design/pcode/colour wiped values the user had typed —
      // which made copying a row and picking the product destroy the copied data.
      if (field === 'product' && value) {
        updated.productName = value.name || updated.productName
        // Barcode is the exception to "fill only what's empty": every row is born with
        // a generated one, but an existing product already has labels printed and stuck
        // on stock, so its barcode must win rather than be replaced.
        updated.barcode = value.barcode || updated.barcode
        updated.design_no = updated.design_no || value.design_no || ''
        updated.pcode = updated.pcode || value.pcode || ''
        updated.size = updated.size || value.size || ''
        updated.colour = updated.colour || value.colour || ''
        updated.mrp = updated.mrp !== '' ? updated.mrp : (value.mrp ?? '')
        updated.unit_cost = updated.unit_cost !== '' ? updated.unit_cost : (value.cost_price ?? '')
        // gst_rate defaults to 5 in EMPTY_ITEM, so it is always truthy and cannot be
        // tested for "empty" like the other fields. Take the product's rate only when
        // the row had no product yet; a row already carrying one keeps its rate.
        updated.gst_rate = item.product ? updated.gst_rate : (value.gst_rate || updated.gst_rate || 5)
        const c = typeof updated.unit_cost === 'number' ? updated.unit_cost : 0
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

  const generateBarcode = (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, barcode: nextCode(lastCode.current, prev) } : i)))
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
    setItems([EMPTY_ITEM('')])
    void loadLastCode()     // the bill just saved used up some numbers
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
    // Never drop a filled-in row quietly: it was the product the client typed.
    const noQty = items.filter(missingQty).length
    const noCost = items.filter(missingCost).length
    if (noQty || noCost) {
      toast.error([noQty && `${noQty} item${noQty > 1 ? 's have' : ' has'} no qty`, noCost && `${noCost} item${noCost > 1 ? 's have' : ' has'} no cost`]
        .filter(Boolean).join(' and ') + ' — marked in red. Nothing saved yet.', { duration: 7000 })
      return
    }
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

      // One trip: the bill, its new products, restocks and lines are saved together
      // in the database (save_purchase), or not at all. This used to be one request
      // per item and then a download of every product — 10–20 s on a big bill.
      const lines = validItems.map(item => {
        const qty = typeof item.qty === 'number' ? item.qty : 0
        const cost = typeof item.unit_cost === 'number' ? item.unit_cost : 0
        const mrp = typeof item.mrp === 'number' ? item.mrp : (cost ? Math.round(cost * 1.4) : null)
        const unitPrice = typeof item.mrp === 'number' ? item.mrp : Math.round(cost * 1.3)
        return {
          product_id: item.product?.id || null,
          name: (item.product?.name || item.productName).trim(),
          design_no: item.design_no || '', pcode: item.pcode || '', size: item.size || '', colour: item.colour || '',
          barcode: item.barcode || makeBarcode(),
          qty, unit_cost: cost, mrp, unit_price: unitPrice, gst_rate: item.gst_rate, line_total: item.line_total,
          online_price: typeof item.online_price === 'number' ? item.online_price : unitPrice,
          wholesale_price: typeof item.wholesale_price === 'number' ? item.wholesale_price : null,
        }
      })
      const { data: saved, error: saveError } = await supabase.rpc('save_purchase', {
        p_bill: {
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
        },
        p_items: lines,
        p_list_online: listOnWebsite,
      })
      if (saveError) throw saveError
      const bill = saved.bill
      const processedItems = validItems.map((item, i) => ({ ...item, barcode: lines[i].barcode, product: saved.products[i] }))

      // The POS copy gets just these products, not a fresh download of all of them.
      try { saveProductsToCache(saved.products) } catch (cacheErr) { console.warn('Product cache refresh warning:', cacheErr) }

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
    items, addItem, updateItem, removeItem, generateBarcode, duplicateItem, duplicateGroupAsSize,
    subtotal, effectiveDiscount, totalGST, cgst, sgst, igst,
    roundOff, netAmount, totalUnits, emptyQtyCount, fillEmptyQty, missingQty, missingCost,
    loading, savePurchase,
    showSuccessModal, setShowSuccessModal,
    purchaseComplete,
    history, historyLoading, historyFilter, setHistoryFilter, fetchHistory,
    counter,
    listOnWebsite, setListOnWebsite,
  }
}
