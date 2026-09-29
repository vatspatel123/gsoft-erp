import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { printExchangeBill, sendExchangeWhatsApp, printCreditNote, sendCreditNoteWhatsApp } from '../utils/printBill'
import { getPendingSales } from '../utils/offlineCache'
import { useCreditNotes, type CreditNote } from '../hooks/useCreditNotes'
import { ArrowLeftRight, Search, X, Check, ChevronRight, RotateCcw, CreditCard } from 'lucide-react'
import { appliedTenders, type Tenders } from '../utils/tenders'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ReturnItem {
  product: any
  qty: number
  originalQty: number
  unit_price: number
  line_total: number
  reason: string
}

interface NewCartItem {
  product: any
  qty: number
  unit_price: number
  line_total: number
}

// ─── Colour helper ────────────────────────────────────────────────────────────
const COLOUR_MAP: Record<string, string> = {
  red:'#ef4444',blue:'#3b82f6',black:'#1e293b',white:'#e2e8f0',
  green:'#16a34a',yellow:'#eab308',pink:'#ec4899',navy:'#1e3a5f',
  grey:'#94a3b8',gray:'#94a3b8',brown:'#92400e',orange:'#f97316',
  purple:'#9333ea',maroon:'#7f1d1d',cream:'#fef9c3'
}
function colourDot(name: string) {
  return COLOUR_MAP[name?.toLowerCase()] || '#94a3b8'
}

const RETURN_REASONS = [
  'Exchange for different size',
  'Exchange for different colour',
  'Exchange for different design',
  'Defective item',
  'Wrong item delivered',
  'Customer changed mind',
]

// ─── Shared style helpers ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px',
  padding: '20px', marginBottom: '16px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px',
  padding: '10px 14px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#1a0a2e', background: 'white', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#9333ea',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: '6px', display: 'block'
}
const btnPrimary: React.CSSProperties = {
  background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px',
  padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif'
}
const btnOutline: React.CSSProperties = {
  background: 'white', color: '#9333ea', border: '1px solid #c084fc',
  borderRadius: '10px', padding: '10px 20px', fontSize: '13px',
  fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ExchangePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [pageTab, setPageTab] = useState<'new' | 'history'>('new')

  // Step 1
  const [searchTab, setSearchTab] = useState<'invoice' | 'phone' | 'barcode'>('invoice')
  const [invoiceInput, setInvoiceInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [phoneResults, setPhoneResults] = useState<any[]>([])
  const [originalInvoice, setOriginalInvoice] = useState<any>(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [step, setStep] = useState(1)

  // Step 2 — return items
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({})
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])

  // Step 3 — replacement
  const [newItems, setNewItems] = useState<NewCartItem[]>([])
  const [replSearch, setReplSearch] = useState('')
  const [replResults, setReplResults] = useState<any[]>([])
  const [replLoading, setReplLoading] = useState(false)
  const [quickVariants, setQuickVariants] = useState<any[]>([])
  const replInputRef = useRef<HTMLInputElement>(null)

  // Right panel
  // What the customer pays when the new items cost more — split like the POS.
  const [tenders, setTenders] = useState<Tenders>({ cash: 0, card: 0, upi: 0 })
  // Set by a "Full" button: that tender then follows the balance as items change.
  const [fullBy, setFullBy] = useState<keyof Tenders | 'udhar' | null>(null)
  const [udharAmt, setUdharAmt] = useState(0)
  const [creditOption, setCreditOption] = useState<'credit_note' | 'loyalty' | 'cash' | 'upi'>('credit_note')
  const [exchangeNotes, setExchangeNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [exchangeComplete, setExchangeComplete] = useState<any>(null)
  const [issuedCreditNote, setIssuedCreditNote] = useState<CreditNote | null>(null)

  const { issueCreditNote } = useCreditNotes()

  // History tab
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Auto-load invoice from URL param
  useEffect(() => {
    const inv = searchParams.get('invoice')
    if (inv) {
      setInvoiceInput(inv)
      loadInvoiceByNo(inv)
    }
  }, [])

  useEffect(() => {
    if (pageTab === 'history') fetchHistory()
  }, [pageTab])

  const ensureSynced = async () => {
    const pending = getPendingSales()
    if (pending.length > 0 && navigator.onLine && (window as any).syncPendingSales) {
      toast.loading('Syncing recent bills to cloud...', { id: 'sync-bills' })
      await (window as any).syncPendingSales()
      toast.dismiss('sync-bills')
    }
  }

  // ── Invoice loaders ──────────────────────────────────────────────────────
  const loadInvoiceByNo = async (no: string) => {
    if (!no.trim()) return
    setLoadingInvoice(true)
    await ensureSynced()
    try {
      const trimmed = no.trim()

      if (navigator.onLine) {
        // 1. Try exact match first
        let { data, error } = await supabase
          .from('sales')
          .select('*, customers(*), users(*), sale_items(*, products(*))')
          .eq('invoice_no', trimmed)
          .maybeSingle()

        // 2. If no exact match, try partial/ilike match
        if (!data) {
          const { data: partialData } = await supabase
            .from('sales')
            .select('*, customers(*), users(*), sale_items(*, products(*))')
            .ilike('invoice_no', `%${trimmed}%`)
            .order('created_at', { ascending: false })
            .limit(1)
          data = partialData?.[0] || null
        }

        if (data) {
          setOriginalInvoice(data)
          initItemSelections(data)
          toast.success(`Loaded invoice ${data.invoice_no}`)
          return
        }
      }

      // 3. Fallback: search local/pending sales
      try {
        const localSalesStr = localStorage.getItem('gsoft_pending_sales')
        if (localSalesStr) {
          const localSales = JSON.parse(localSalesStr)
          const found = localSales.find((s: any) =>
            s.invoiceNo?.includes(trimmed) || s.invoice_no?.includes(trimmed)
          )
          if (found) {
            if (navigator.onLine && (window as any).syncPendingSales) {
              toast.loading('Syncing local bill to cloud...', { id: 'sync-bill' })
              await (window as any).syncPendingSales()
              toast.dismiss('sync-bill')
              
              // Retry fetching from Supabase now that it's synced
              const { data: retryData } = await supabase
                .from('sales')
                .select('*, customers(*), users(*), sale_items(*, products(*))')
                .eq('invoice_no', found.invoiceNo || found.invoice_no)
                .maybeSingle()
                
              if (retryData) {
                setOriginalInvoice(retryData)
                initItemSelections(retryData)
                toast.success(`Loaded invoice ${retryData.invoice_no}`)
                return
              }
            }
            toast.error('This invoice is saved locally. Please connect to internet to sync it before exchange.')
            return
          }
        }
      } catch {}

      toast.error('Invoice not found. Check the invoice number and try again.')
    } catch (e) {
      console.error('Invoice search error:', e)
      toast.error('Failed to load invoice — check your connection')
    } finally {
      setLoadingInvoice(false)
    }
  }

  const loadInvoicesByPhone = async () => {
    if (!phoneInput.trim()) return
    setLoadingInvoice(true)
    await ensureSynced()
    try {
      if (!navigator.onLine) {
        toast.error('Phone search requires internet connection')
        setLoadingInvoice(false)
        return
      }
      // Search customers by phone (partial match)
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .ilike('phone', `%${phoneInput.trim()}%`)
      if (!customers || customers.length === 0) {
        toast.error('No customer found with this phone number')
        setLoadingInvoice(false)
        return
      }
      const customerIds = customers.map(c => c.id)
      const { data } = await supabase
        .from('sales')
        .select('*, customers(*), sale_items(*, products(*))')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!data || data.length === 0) {
        toast.error('No invoices found for this customer')
      }
      setPhoneResults(data || [])
    } catch { toast.error('Search failed — check your connection') }
    finally { setLoadingInvoice(false) }
  }

  const loadInvoiceByBarcode = async (barcode: string) => {
    if (!barcode.trim()) return
    setLoadingInvoice(true)
    await ensureSynced()
    try {
      if (!navigator.onLine) {
        toast.error('Barcode search requires internet connection')
        setLoadingInvoice(false)
        return
      }
      const { data: prod } = await supabase
        .from('products').select('id').eq('barcode', barcode.trim()).maybeSingle()
      if (!prod) { toast.error('Product not found for this barcode'); setLoadingInvoice(false); return }
      const { data: items } = await supabase
        .from('sale_items').select('sale_id')
        .eq('product_id', prod.id)
        .order('created_at' as any, { ascending: false }).limit(1)
      if (!items || items.length === 0) { toast.error('No invoice found for this product'); setLoadingInvoice(false); return }
      const { data } = await supabase
        .from('sales')
        .select('*, customers(*), users(*), sale_items(*, products(*))')
        .eq('id', items[0].sale_id).single()
      if (data) {
        setOriginalInvoice(data)
        initItemSelections(data)
        toast.success(`Loaded invoice ${data.invoice_no}`)
      } else {
        toast.error('Invoice not found')
      }
    } catch { toast.error('Barcode search failed — check your connection') }
    finally { setLoadingInvoice(false) }
  }

  const selectPhoneInvoice = (invoice: any) => {
    setOriginalInvoice(invoice)
    initItemSelections(invoice)
    setPhoneResults([])
    toast.success(`Loaded invoice ${invoice.invoice_no}`)
  }

  const initItemSelections = (invoice: any) => {
    const sel: Record<string, boolean> = {}
    const qtys: Record<string, number> = {}
    const reasons: Record<string, string> = {}
    invoice.sale_items?.forEach((item: any) => {
      sel[item.id] = false
      qtys[item.id] = item.qty
      reasons[item.id] = RETURN_REASONS[0]
    })
    setSelectedItems(sel)
    setReturnQtys(qtys)
    setReturnReasons(reasons)
  }

  // ── Step navigation ───────────────────────────────────────────────────────
  const confirmReturnItems = () => {
    const items: ReturnItem[] = (originalInvoice?.sale_items || [])
      .filter((si: any) => selectedItems[si.id])
      .map((si: any) => ({
        product: si.products,
        qty: returnQtys[si.id] || si.qty,
        originalQty: si.qty,
        unit_price: si.unit_price,
        line_total: si.unit_price * (returnQtys[si.id] || si.qty),
        reason: returnReasons[si.id] || RETURN_REASONS[0]
      }))
    if (items.length === 0) { toast.error('Select at least one item to return'); return }
    setReturnItems(items)
    // Pre-load quick variants for first returned item
    if (items[0]?.product?.name) loadQuickVariants(items[0].product.name, items[0].product.id)
    setStep(3)
    setTimeout(() => replInputRef.current?.focus(), 100)
  }

  const loadQuickVariants = async (name: string, excludeId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .ilike('name', name)
      .eq('is_active', true)
      .neq('id', excludeId)
    setQuickVariants(data || [])
  }

  // ── Replacement search ────────────────────────────────────────────────────
  const searchReplacement = async (q: string) => {
    if (!q.trim()) { setReplResults([]); return }
    setReplLoading(true)
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%,design_no.ilike.%${q}%`)
        .eq('is_active', true)
        .limit(8)
      setReplResults(data || [])
    } catch { } finally { setReplLoading(false) }
  }

  const addNewItem = (product: any) => {
    setNewItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i => i.product.id === product.id
          ? { ...i, qty: i.qty + 1, line_total: i.unit_price * (i.qty + 1) }
          : i)
      }
      return [...prev, { product, qty: 1, unit_price: product.unit_price, line_total: product.unit_price }]
    })
    setReplSearch('')
    setReplResults([])
  }

  const updateNewItemQty = (productId: string, qty: number) => {
    if (qty <= 0) { setNewItems(prev => prev.filter(i => i.product.id !== productId)); return }
    setNewItems(prev => prev.map(i => i.product.id === productId
      ? { ...i, qty, line_total: i.unit_price * qty } : i))
  }

  const removeNewItem = (productId: string) => {
    setNewItems(prev => prev.filter(i => i.product.id !== productId))
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const returnTotal = returnItems.reduce((s, i) => s + i.line_total, 0)
  const newTotal = newItems.reduce((s, i) => s + i.line_total, 0)
  const balance = newTotal - returnTotal // positive = customer pays, negative = store owes

  // Customer-pays side: same rules as the POS. Cash / card / UPI / udhar are each
  // typed; "Full" fills that row with whatever the other rows leave and keeps
  // following the balance. Only what the shop keeps is recorded — change handed
  // back isn't income.
  const due = Math.max(0, Math.round(balance * 100) / 100)
  // Udhar only against a named customer — a walk-in can't be chased for it.
  // Due in 5 days, as at the POS.
  const canUdhar = !!originalInvoice?.customer_id
  const udhar = canUdhar ? Math.min(udharAmt, due) : 0
  const fillRest = (k: keyof Tenders | 'udhar') => {
    const others = tenders.cash + tenders.card + tenders.upi + udhar - (k === 'udhar' ? udhar : tenders[k])
    const rest = Math.max(0, Math.round((due - others) * 100) / 100)
    if (k === 'udhar') setUdharAmt(rest)
    else setTenders(t => ({ ...t, [k]: rest }))
  }
  useEffect(() => {
    if (due <= 0) { setTenders({ cash: 0, card: 0, upi: 0 }); setUdharAmt(0); setFullBy(null); return }
    if (fullBy) fillRest(fullBy)
  }, [due, fullBy])
  const toCollect = Math.round((due - udhar) * 100) / 100
  const kept = appliedTenders(tenders, toCollect)
  const keptTotal = kept.cash + kept.card + kept.upi
  const short = Math.max(0, Math.round((toCollect - keptTotal) * 100) / 100)
  const udharDue = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const change = Math.max(0, Math.round((tenders.cash + tenders.card + tenders.upi - toCollect) * 100) / 100)
  // payment_mode is a single legacy field: record whichever tender carried most of it.
  const mainTender: keyof Tenders =
    kept.upi >= kept.cash && kept.upi >= kept.card && kept.upi > 0 ? 'upi'
      : kept.card > kept.cash ? 'card' : 'cash'

  const daysSince = originalInvoice
    ? Math.floor((Date.now() - new Date(originalInvoice.created_at).getTime()) / 86400000)
    : 0
  const withinPolicy = daysSince <= 7

  // ── Process exchange ──────────────────────────────────────────────────────
  const processExchange = async () => {
    if (returnItems.length === 0) { toast.error('No return items selected'); return }
    if (due > 0 && short > 0.009) {
      toast.error(canUdhar
        ? `₹${short.toFixed(2)} is not covered — collect it, or put it in Udhar`
        : `Collect ₹${short.toFixed(2)} more — the original bill has no customer, so the balance can't go on udhar`)
      return
    }
    if (!navigator.onLine) { toast.error('Exchange requires internet connection'); return }
    setProcessing(true)
    try {
      const exchangeNo = 'EXC-' +
        new Date().toISOString().slice(0, 10).replace(/-/g, '') +
        '-' + String(Math.floor(Math.random() * 9000) + 1000)

      // Try to create exchange record in DB
      let exchangeId: string | null = null
      try {
        const { data: exchange, error: excErr } = await supabase
          .from('exchange_bills')
          .insert({
            exchange_no: exchangeNo,
            original_sale_id: originalInvoice.id,
            original_invoice_no: originalInvoice.invoice_no,
            customer_id: originalInvoice.customer_id || null,
            return_amount: returnTotal,
            new_sale_amount: newTotal,
            balance_amount: Math.abs(balance),
            balance_type: balance === 0 ? 'nil' : balance > 0 ? 'customer_pays' : 'store_credit',
            payment_mode: due > 0 ? mainTender : (creditOption === 'upi' ? 'upi' : 'cash'),
            cash_amount: kept.cash,
            card_amount: kept.card,
            upi_amount: kept.upi,
            // Unpaid balance: udhar, listed and collected in Accounts -> Receivables.
            credit_amount: udhar,
            credit_paid: 0,
            credit_status: udhar > 0.009 ? 'unpaid' : 'paid',
            credit_due_date: udhar > 0.009 ? udharDue : null,
            notes: exchangeNotes || null,
            status: 'completed'
          })
          .select().single()

        if (excErr) {
          // Table might not exist — log warning but continue with stock adjustments
          console.warn('Exchange record insert failed (table may not exist):', excErr.message)
          if (excErr.message?.includes('relation') && excErr.message?.includes('does not exist')) {
            toast.error('Exchange tables not set up yet. Please run EXCHANGE_SCHEMA.sql in your Supabase SQL Editor first.')
            setProcessing(false)
            return
          }
          throw excErr
        }
        exchangeId = exchange?.id || null
      } catch (dbErr: any) {
        if (dbErr?.message?.includes('relation') || dbErr?.message?.includes('does not exist')) {
          toast.error('Exchange tables not set up. Run EXCHANGE_SCHEMA.sql in Supabase SQL Editor.')
          setProcessing(false)
          return
        }
        console.warn('Exchange DB error, continuing with stock adjustments:', dbErr)
      }

      // Insert return items (if exchange record was created)
      if (exchangeId) {
        try {
          await supabase.from('exchange_return_items').insert(
            returnItems.map(i => ({
              exchange_id: exchangeId,
              product_id: i.product.id,
              qty: i.qty,
              unit_price: i.unit_price,
              line_total: i.line_total,
              reason: i.reason
            }))
          )
        } catch (e) { console.warn('Failed to insert return items:', e) }

        // Insert new items (skip if this is a return-only exchange with no replacement)
        if (newItems.length > 0) {
          try {
            await supabase.from('exchange_new_items').insert(
              newItems.map(i => ({
                exchange_id: exchangeId,
                product_id: i.product.id,
                qty: i.qty,
                unit_price: i.unit_price,
                line_total: i.line_total
              }))
            )
          } catch (e) { console.warn('Failed to insert new items:', e) }
        }
      }

      // Restore stock for returned items
      for (const item of returnItems) {
        try {
          const { data: p } = await supabase.from('products').select('stock_qty').eq('id', item.product.id).single()
          if (p) await supabase.from('products').update({ stock_qty: p.stock_qty + item.qty }).eq('id', item.product.id)
        } catch (e) { console.warn('Stock restore failed for', item.product.name, e) }
      }

      // Deduct stock for new items
      for (const item of newItems) {
        try {
          const { data: p } = await supabase.from('products').select('stock_qty').eq('id', item.product.id).single()
          if (p) await supabase.from('products').update({ stock_qty: Math.max(0, p.stock_qty - item.qty) }).eq('id', item.product.id)
        } catch (e) { console.warn('Stock deduction failed for', item.product.name, e) }
      }

      // Issue Credit Note or loyalty points if store refund
      let cnResult: CreditNote | null = null
      if (balance < 0) {
        if (creditOption === 'credit_note') {
          cnResult = await issueCreditNote({
            customer_id: originalInvoice.customer_id || undefined,
            customer_name: originalInvoice.customers?.name || 'Customer',
            customer_phone: originalInvoice.customers?.phone || undefined,
            original_sale_id: originalInvoice.id,
            amount: Math.abs(balance),
            notes: `Exchange Return Balance for Invoice ${originalInvoice.invoice_no}`
          })
          setIssuedCreditNote(cnResult)
        } else if (creditOption === 'loyalty' && originalInvoice.customer_id) {
          try {
            const pointsToAdd = Math.floor(Math.abs(balance) * 4)
            const { data: cust } = await supabase.from('customers').select('loyalty_points').eq('id', originalInvoice.customer_id).single()
            if (cust) await supabase.from('customers').update({ loyalty_points: (cust.loyalty_points || 0) + pointsToAdd }).eq('id', originalInvoice.customer_id)
          } catch (e) { console.warn('Loyalty points update failed:', e) }
        }
      }

      const completeData = {
        exchangeNo, returnItems, newItems,
        returnTotal, newTotal, balance,
        tenders: due > 0 ? kept : null,
        udhar,
        customer: originalInvoice.customers,
        originalInvoiceNo: originalInvoice.invoice_no,
        creditNote: cnResult
      }
      setExchangeComplete(completeData)
      setShowSuccessModal(true)
      toast.success('Exchange completed! ' + exchangeNo)
    } catch (e: any) {
      console.error('Exchange processing error:', e)
      toast.error(e.message || 'Exchange failed — check your connection')
    } finally {
      setProcessing(false)
    }
  }

  const resetAll = () => {
    setOriginalInvoice(null); setStep(1); setInvoiceInput(''); setPhoneInput('')
    setBarcodeInput(''); setPhoneResults([]); setReturnItems([]); setNewItems([])
    setReplSearch(''); setReplResults([]); setQuickVariants([]); setExchangeNotes('')
    setShowSuccessModal(false); setExchangeComplete(null)
    setSelectedItems({}); setReturnQtys({}); setReturnReasons({})
  }

  // ── History ───────────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('exchange_bills')
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(50)
      setHistory(data || [])
    } catch { } finally { setHistoryLoading(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#fdf8ff', minHeight: '100%', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowLeftRight size={20} color="#9333ea" />
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Exchange / Return</h1>
          </div>
          {/* Tab switcher */}
          <div style={{ display: 'inline-flex', background: 'white', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '3px', gap: '3px' }}>
            {(['new', 'history'] as const).map(t => (
              <button key={t} onClick={() => setPageTab(t)} style={{
                padding: '7px 18px', borderRadius: '7px', border: 'none',
                background: pageTab === t ? '#9333ea' : 'transparent',
                color: pageTab === t ? 'white' : '#64748b',
                fontSize: '13px', fontWeight: pageTab === t ? 600 : 400,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
              }}>
                {t === 'new' ? 'New Exchange' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ HISTORY TAB ═══════ */}
        {pageTab === 'history' && (
          <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', overflow: 'hidden' }}>
            {historyLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading history...</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔄</div>
                <div style={{ color: '#64748b', fontWeight: 500 }}>No exchanges yet</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3e8ff' }}>
                      {['Exchange No', 'Date', 'Customer', 'Original Bill', 'Returned', 'Given', 'Balance', 'Type', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(exc => (
                      <tr key={exc.id} style={{ borderBottom: '1px solid #fdf8ff' }}>
                        <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#9333ea', fontWeight: 600 }}>{exc.exchange_no}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>{new Date(exc.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px' }}>{exc.customers?.name || '—'}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#94a3b8' }}>{exc.original_invoice_no}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#ef4444' }}>₹{Number(exc.return_amount).toFixed(0)}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#16a34a' }}>₹{Number(exc.new_sale_amount).toFixed(0)}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>₹{Number(exc.balance_amount).toFixed(0)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
                            background: exc.balance_type === 'nil' ? '#f0fdf4' : exc.balance_type === 'customer_pays' ? '#fff7ed' : '#eff6ff',
                            color: exc.balance_type === 'nil' ? '#16a34a' : exc.balance_type === 'customer_pays' ? '#f59e0b' : '#3b82f6'
                          }}>
                            {exc.balance_type === 'nil' ? 'Zero' : exc.balance_type === 'customer_pays' ? 'Paid' : 'Credit'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={() => { /* reprint */ }} title="Reprint"
                            style={{ background: '#f5f3ff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#9333ea', fontSize: '11px' }}>
                            🖨️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════ NEW EXCHANGE TAB ═══════ */}
        {pageTab === 'new' && (
          <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: '20px', alignItems: 'start' }}>

            {/* ── LEFT PANEL ─────────────────────────────────────────── */}
            <div>
              {/* Step indicator */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700,
                      background: step > s ? '#16a34a' : step === s ? '#9333ea' : '#f3e8ff',
                      color: step >= s ? 'white' : '#9333ea'
                    }}>
                      {step > s ? <Check size={14} /> : s}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: step === s ? 600 : 400, color: step === s ? '#1a0a2e' : '#94a3b8' }}>
                      {s === 1 ? 'Find Original Bill' : s === 2 ? 'Select Return Items' : 'Add Replacement'}
                    </span>
                    {s < 3 && <ChevronRight size={14} color="#cbd5e1" />}
                  </div>
                ))}
              </div>

              {/* ── STEP 1: Find Original Bill ── */}
              {step === 1 && (
                <div style={card}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e', marginBottom: '16px' }}>Step 1: Find Original Bill</div>

                  {/* Search tabs */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                    {(['invoice', 'phone', 'barcode'] as const).map(t => (
                      <button key={t} onClick={() => setSearchTab(t)} style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 500,
                        background: searchTab === t ? '#9333ea' : '#f5f3ff', color: searchTab === t ? 'white' : '#9333ea',
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
                      }}>
                        {t === 'invoice' ? '📄 Invoice No' : t === 'phone' ? '📱 Customer Phone' : '📷 Scan Barcode'}
                      </button>
                    ))}
                  </div>

                  {/* Invoice number search */}
                  {searchTab === 'invoice' && (
                    <div>
                      <label style={labelStyle}>Invoice Number</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={invoiceInput}
                          onChange={e => setInvoiceInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && loadInvoiceByNo(invoiceInput)}
                          placeholder="INV-20260325-0001" />
                        <button onClick={() => loadInvoiceByNo(invoiceInput)} disabled={loadingInvoice}
                          style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: loadingInvoice ? 0.6 : 1 }}>
                          {loadingInvoice ? 'Searching...' : <><Search size={14} /> Search</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Phone search */}
                  {searchTab === 'phone' && (
                    <div>
                      <label style={labelStyle}>Customer Phone Number</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={phoneInput}
                          onChange={e => setPhoneInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && loadInvoicesByPhone()}
                          placeholder="9924145535" />
                        <button onClick={loadInvoicesByPhone} disabled={loadingInvoice}
                          style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: loadingInvoice ? 0.6 : 1 }}>
                          {loadingInvoice ? '...' : 'Find Bills'}
                        </button>
                      </div>
                      {phoneResults.map(inv => (
                        <div key={inv.id} onClick={() => selectPhoneInvoice(inv)}
                          style={{ padding: '12px', border: '1px solid #f3e8ff', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#9333ea', fontSize: '13px', fontFamily: 'DM Mono, monospace' }}>{inv.invoice_no}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{new Date(inv.created_at).toLocaleDateString('en-IN')} · ₹{inv.net_amount}</div>
                          </div>
                          <ChevronRight size={14} color="#9333ea" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Barcode search */}
                  {searchTab === 'barcode' && (
                    <div>
                      <label style={labelStyle}>Scan Item Barcode</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && loadInvoiceByBarcode(barcodeInput)}
                          placeholder="Scan or type barcode..." autoFocus />
                        <button onClick={() => loadInvoiceByBarcode(barcodeInput)} disabled={loadingInvoice}
                          style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: loadingInvoice ? 0.6 : 1 }}>
                          {loadingInvoice ? '...' : 'Search'}
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>Scan the barcode on the returned item to find the original invoice</div>
                    </div>
                  )}

                  {/* Invoice found — green card */}
                  {originalInvoice && (
                    <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '14px', fontFamily: 'DM Mono, monospace' }}>{originalInvoice.invoice_no}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {new Date(originalInvoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {daysSince} day{daysSince !== 1 ? 's' : ''} ago
                          </div>
                          {originalInvoice.customers && (
                            <div style={{ fontSize: '12px', color: '#1a0a2e', marginTop: '2px', fontWeight: 500 }}>
                              {originalInvoice.customers.name} · {originalInvoice.customers.phone}
                            </div>
                          )}
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#9333ea', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>₹{Number(originalInvoice.net_amount).toFixed(2)}</div>
                        </div>
                        <div>
                          <span style={{
                            padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                            background: withinPolicy ? '#f0fdf4' : '#fef2f2',
                            color: withinPolicy ? '#16a34a' : '#ef4444',
                            border: `1px solid ${withinPolicy ? '#bbf7d0' : '#fecaca'}`
                          }}>
                            {withinPolicy ? `✓ ${daysSince}d — Within policy` : `⚠️ ${daysSince}d — Policy exceeded`}
                          </span>
                        </div>
                      </div>

                      {!withinPolicy && (
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '11px', color: '#b45309' }}>
                          ⚠️ {daysSince} days since purchase — Exchange policy may not apply (owner decision)
                        </div>
                      )}

                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Select items to return:</div>

                      {originalInvoice.sale_items?.map((si: any) => (
                        <div key={si.id} onClick={() => setSelectedItems(prev => ({ ...prev, [si.id]: !prev[si.id] }))}
                          style={{
                            padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '6px',
                            border: selectedItems[si.id] ? '2px solid #9333ea' : '1px solid #f3e8ff',
                            background: selectedItems[si.id] ? '#fdf8ff' : 'white',
                            display: 'flex', alignItems: 'center', gap: '10px'
                          }}>
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '4px', border: '2px solid',
                            borderColor: selectedItems[si.id] ? '#9333ea' : '#cbd5e1',
                            background: selectedItems[si.id] ? '#9333ea' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {selectedItems[si.id] && <Check size={11} color="white" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{si.products?.name || 'Unknown'}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px', display: 'flex', gap: '8px' }}>
                              {si.products?.size && <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '0 5px', borderRadius: '4px', fontWeight: 600 }}>{si.products.size}</span>}
                              {si.products?.colour && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: colourDot(si.products.colour) }} />
                                  {si.products.colour}
                                </span>
                              )}
                              {si.products?.design_no && <span>D:{si.products.design_no}</span>}
                              <span>Qty: {si.qty}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#9333ea', fontSize: '13px' }}>₹{si.line_total.toFixed(2)}</div>
                        </div>
                      ))}

                      <button
                        onClick={() => setStep(2)}
                        disabled={!Object.values(selectedItems).some(Boolean)}
                        style={{ ...btnPrimary, width: '100%', marginTop: '12px', opacity: Object.values(selectedItems).some(Boolean) ? 1 : 0.4 }}>
                        Next: Set Return Details →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Return Item Details ── */}
              {step === 2 && (
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e' }}>Step 2: Items Being Returned</div>
                    <button onClick={() => setStep(1)} style={{ ...btnOutline, padding: '6px 14px', fontSize: '12px' }}>← Back</button>
                  </div>

                  {(originalInvoice?.sale_items || [])
                    .filter((si: any) => selectedItems[si.id])
                    .map((si: any) => (
                      <div key={si.id} style={{ border: '1px solid #f3e8ff', borderRadius: '12px', padding: '14px', marginBottom: '12px', background: '#fef2f2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1a0a2e', fontSize: '13px' }}>{si.products?.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '6px' }}>
                              {si.products?.size && <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '0 5px', borderRadius: '4px', fontWeight: 600 }}>{si.products.size}</span>}
                              {si.products?.colour && <span>{si.products.colour}</span>}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>₹{si.unit_price.toFixed(2)}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Qty to Return</label>
                            <input type="number" min={1} max={si.qty} value={returnQtys[si.id] || si.qty}
                              onChange={e => setReturnQtys(prev => ({ ...prev, [si.id]: parseInt(e.target.value) || 1 }))}
                              style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Return Reason</label>
                            <select value={returnReasons[si.id] || RETURN_REASONS[0]}
                              onChange={e => setReturnReasons(prev => ({ ...prev, [si.id]: e.target.value }))}
                              style={inputStyle}>
                              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                  <button onClick={confirmReturnItems} style={{ ...btnPrimary, width: '100%' }}>
                    Confirm Return Items →
                  </button>
                </div>
              )}

              {/* ── STEP 3: Add Replacement ── */}
              {step === 3 && (
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e' }}>Step 3: Select Replacement Items</div>
                    <button onClick={() => setStep(2)} style={{ ...btnOutline, padding: '6px 14px', fontSize: '12px' }}>← Back</button>
                  </div>

                  {/* Quick variants of the returned item */}
                  {quickVariants.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                        Same Item — Different Size/Colour:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {quickVariants.map(v => (
                          <button key={v.id} onClick={() => addNewItem(v)}
                            style={{ padding: '5px 12px', borderRadius: '99px', border: '1px solid #e9d5ff', background: '#fdf8ff', cursor: 'pointer', fontSize: '12px', color: '#1a0a2e', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'DM Sans, sans-serif' }}>
                            {v.colour && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourDot(v.colour), border: '1px solid rgba(0,0,0,0.1)' }} />}
                            {v.size && <span style={{ fontWeight: 700, color: '#9333ea' }}>{v.size}</span>}
                            {v.colour && <span>{v.colour}</span>}
                            <span style={{ color: '#9333ea', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>₹{v.unit_price}</span>
                            <span style={{ fontSize: '10px', color: v.stock_qty > 0 ? '#16a34a' : '#ef4444' }}>{v.stock_qty} pcs</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search replacement */}
                  <div style={{ position: 'relative', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9333ea' }} />
                        <input
                          ref={replInputRef}
                          style={{ ...inputStyle, paddingLeft: '36px' }}
                          value={replSearch}
                          onChange={e => { setReplSearch(e.target.value); searchReplacement(e.target.value) }}
                          placeholder="Search replacement product..."
                        />
                      </div>
                    </div>
                    {replResults.length > 0 && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #f3e8ff', borderRadius: '10px', boxShadow: '0 8px 24px rgba(147,51,234,0.1)', maxHeight: '280px', overflowY: 'auto' }}>
                        {replResults.map(p => (
                          <div key={p.id} onMouseDown={() => addNewItem(p)}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #fdf8ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{p.name}</div>
                              <div style={{ fontSize: '11px', color: '#9333ea', display: 'flex', gap: '6px', marginTop: '1px' }}>
                                {p.size && <span style={{ background: '#f5f3ff', padding: '0 5px', borderRadius: '4px', fontWeight: 600 }}>{p.size}</span>}
                                {p.colour && <span>{p.colour}</span>}
                                {p.design_no && <span style={{ color: '#94a3b8' }}>D:{p.design_no}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>₹{p.unit_price}</div>
                              <div style={{ fontSize: '10px', color: p.stock_qty > 0 ? '#16a34a' : '#ef4444' }}>{p.stock_qty} pcs</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* New items cart */}
                  {newItems.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '2px dashed #f3e8ff', borderRadius: '10px' }}>
                      Search above or click a variant to add replacement items
                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#9333ea', fontWeight: 600 }}>
                        — or leave this empty and click "Complete Return & Issue Credit Note" on the right to refund the customer with store credit instead of a replacement item —
                      </div>
                    </div>
                  ) : (
                    newItems.map(item => (
                      <div key={item.product.id} style={{ border: '1px solid #f3e8ff', borderRadius: '10px', padding: '12px', marginBottom: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{item.product.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '6px', marginTop: '1px' }}>
                            {item.product.size && <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '0 5px', borderRadius: '4px', fontWeight: 600 }}>{item.product.size}</span>}
                            {item.product.colour && <span>{item.product.colour}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => updateNewItemQty(item.product.id, item.qty - 1)} style={{ width: '26px', height: '26px', border: '1px solid #f3e8ff', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: '#9333ea' }}>−</button>
                          <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{item.qty}</span>
                          <button onClick={() => updateNewItemQty(item.product.id, item.qty + 1)} style={{ width: '26px', height: '26px', border: '1px solid #f3e8ff', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: '#9333ea' }}>+</button>
                        </div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#16a34a', fontSize: '13px', minWidth: '70px', textAlign: 'right' }}>₹{item.line_total.toFixed(2)}</div>
                        <button onClick={() => removeNewItem(item.product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT PANEL ────────────────────────────────────────── */}
            <div style={{ position: 'sticky', top: '24px' }}>
              <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '20px' }}>

                {/* Customer */}
                {originalInvoice?.customers ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f3e8ff' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f5f3ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                      {originalInvoice.customers.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a0a2e', fontSize: '13px' }}>{originalInvoice.customers.name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{originalInvoice.customers.phone}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f3e8ff' }}>Walk-in Customer</div>
                )}

                {/* Return Summary */}
                {returnItems.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>↩ Items Returned</div>
                    {returnItems.map((ri, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', color: '#64748b' }}>
                        <span>{ri.product.name}{ri.product.size ? ` (${ri.product.size})` : ''} ×{ri.qty}</span>
                        <span style={{ color: '#ef4444', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>-₹{ri.line_total.toFixed(0)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#ef4444', borderTop: '1px solid #fee2e2', paddingTop: '6px', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
                      <span>Return Total</span><span>₹{returnTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* New Items Summary */}
                {newItems.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>+ Items Given</div>
                    {newItems.map((ni, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', color: '#64748b' }}>
                        <span>{ni.product.name}{ni.product.size ? ` (${ni.product.size})` : ''} ×{ni.qty}</span>
                        <span style={{ color: '#16a34a', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>+₹{ni.line_total.toFixed(0)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#16a34a', borderTop: '1px solid #dcfce7', paddingTop: '6px', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
                      <span>New Total</span><span>₹{newTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Balance */}
                {returnItems.length > 0 && (
                  <div style={{ borderTop: '2px solid #f3e8ff', paddingTop: '14px', marginBottom: '14px' }}>
                    {balance === 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', marginBottom: '4px' }}>✅</div>
                        <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '14px' }}>Zero Balance</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>No payment needed</div>
                      </div>
                    )}
                    {balance > 0 && (
                      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '14px', marginBottom: '4px' }}>
                          Customer Pays ₹{balance.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>New items cost more than returned items</div>
                        {/* Split payment, as at the POS: type each part, or tap Full. */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {([['cash', '💵 Cash'], ['card', '💳 Card'], ['upi', '📱 UPI'],
                            ...(canUdhar ? [['udhar', '📝 Udhar']] : [])] as [keyof Tenders | 'udhar', string][]).map(([k, label]) => (
                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '64px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>{label}</span>
                              <input
                                type="number" min={0} step="0.01" inputMode="decimal"
                                value={(k === 'udhar' ? udharAmt : tenders[k]) || ''}
                                placeholder="0.00"
                                onChange={e => {
                                  setFullBy(null)   // typed by hand: stop following the balance
                                  const v = Math.max(0, Number(e.target.value) || 0)
                                  if (k === 'udhar') setUdharAmt(v)
                                  else setTenders(t => ({ ...t, [k]: v }))
                                }}
                                style={{ ...inputStyle, flex: 1, padding: '8px 10px', borderColor: '#fed7aa', fontFamily: 'DM Mono, monospace' }}
                              />
                              <button
                                onClick={() => { setFullBy(k); fillRest(k) }}
                                style={{
                                  padding: '8px 12px', borderRadius: '8px', border: '1px solid #fed7aa',
                                  background: fullBy === k ? '#f59e0b' : '#fff7ed', color: fullBy === k ? 'white' : '#92400e',
                                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
                                }}>Full</button>
                            </div>
                          ))}
                          <div style={{
                            display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                            background: short > 0 ? '#fef2f2' : '#f0fdf4',
                            color: short > 0 ? '#b91c1c' : '#15803d'
                          }}>
                            <span>{short > 0
                              ? canUdhar
                                ? `₹${short.toFixed(2)} not covered — collect it or put it in Udhar`
                                : `Collect ₹${short.toFixed(2)} more (walk-in: no udhar)`
                              : change > 0 ? `✓ Paid · give ₹${change.toFixed(2)} change` : '✓ Fully covered'}</span>
                            {udhar > 0 && <span style={{ color: '#b45309' }}>
                              Udhar ₹{udhar.toFixed(2)} → added to {originalInvoice?.customers?.name || 'customer'}'s dues
                            </span>}
                            <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 500, color: '#64748b' }}>
                              Paid now ₹{keptTotal.toFixed(2)}{udhar > 0 ? ` + Udhar ₹${udhar.toFixed(2)}` : ''} of ₹{due.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {balance < 0 && (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '14px', marginBottom: '4px' }}>
                          Store Owes ₹{Math.abs(balance).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>{newItems.length === 0 ? 'No replacement taken — full return' : 'Returned items cost more than new items'}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {([
                            ['credit_note', `🎫 Issue Credit Note Voucher (₹${Math.abs(balance).toFixed(2)})`],
                            ['cash', '💵 Cash Refund'],
                            ['upi', '📱 UPI / Bank Refund'],
                            ['loyalty', `💎 Add ${Math.floor(Math.abs(balance) * 4)} Loyalty Points`]
                          ] as [string, string][]).map(([opt, label]) => (
                            <label key={opt} style={{
                              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                              fontSize: '12px', color: '#1a0a2e', padding: '6px 8px', borderRadius: '8px',
                              background: creditOption === opt ? '#dbeafe' : 'white',
                              border: creditOption === opt ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                              fontWeight: creditOption === opt ? 600 : 400
                            }}>
                              <input type="radio" name="credit" value={opt} checked={creditOption === opt as any} onChange={() => setCreditOption(opt as any)} style={{ accentColor: '#2563eb' }} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <textarea value={exchangeNotes} onChange={e => setExchangeNotes(e.target.value)}
                  placeholder="Add exchange notes (optional)..."
                  style={{ ...inputStyle, resize: 'none', minHeight: '60px', marginBottom: '14px', fontSize: '12px' }} rows={2} />

                {/* Complete Button */}
                <button
                  onClick={processExchange}
                  disabled={processing || returnItems.length === 0 || (due > 0 && short > 0.009)}
                  style={{
                    ...btnPrimary, width: '100%', padding: '14px', fontSize: '14px',
                    opacity: processing || returnItems.length === 0 || (due > 0 && short > 0.009) ? 0.4 : 1,
                    cursor: processing || returnItems.length === 0 || (due > 0 && short > 0.009) ? 'not-allowed' : 'pointer'
                  }}>
                  {processing ? 'Processing...' : newItems.length === 0 ? '🎫 Complete Return & Issue Credit Note' : '🔄 Complete Exchange'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ SUCCESS MODAL ═══════ */}
        {showSuccessModal && exchangeComplete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Exchange Complete!</div>
                <div style={{ fontSize: '13px', color: '#9333ea', fontFamily: 'DM Mono, monospace', marginTop: '4px', fontWeight: 600 }}>
                  {exchangeComplete.exchangeNo}
                </div>
              </div>

              {/* Receipt preview */}
              <div style={{ background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '12px', padding: '16px', marginBottom: '20px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                  <span>Ref:</span><span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{exchangeComplete.originalInvoiceNo}</span>
                </div>
                {exchangeComplete.customer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '8px' }}>
                    <span>Customer:</span><span style={{ fontWeight: 600, color: '#1a0a2e' }}>{exchangeComplete.customer.name}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #e9d5ff', margin: '8px 0', paddingTop: '8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Returned:</div>
                  {exchangeComplete.returnItems.map((ri: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginBottom: '2px' }}>
                      <span>↩ {ri.product.name}{ri.product.size ? ` ${ri.product.size}` : ''}{ri.product.colour ? ` ${ri.product.colour}` : ''} ×{ri.qty}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace' }}>₹{ri.line_total.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px dashed #e9d5ff', margin: '8px 0', paddingTop: '8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: '4px' }}>Given:</div>
                  {exchangeComplete.newItems.map((ni: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: '2px' }}>
                      <span>+ {ni.product.name}{ni.product.size ? ` ${ni.product.size}` : ''}{ni.product.colour ? ` ${ni.product.colour}` : ''} ×{ni.qty}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace' }}>₹{ni.line_total.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '2px solid #9333ea', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>
                  <span>{exchangeComplete.balance === 0 ? 'Zero Balance Exchange' : exchangeComplete.balance > 0 ? (exchangeComplete.udhar > 0 ? `Customer Balance: ₹${exchangeComplete.balance.toFixed(2)} · Udhar ₹${exchangeComplete.udhar.toFixed(2)}` : `Customer Paid: ₹${exchangeComplete.balance.toFixed(2)}`) : `Store Credit: ₹${Math.abs(exchangeComplete.balance).toFixed(2)}`}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => printExchangeBill(exchangeComplete)} style={{ ...btnPrimary, flex: 1 }}>🖨️ Print Receipt</button>
                  <button
                    onClick={() => sendExchangeWhatsApp(exchangeComplete)}
                    disabled={!exchangeComplete.customer?.phone}
                    style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: exchangeComplete.customer?.phone ? 1 : 0.4 }}>
                    💬 WhatsApp
                  </button>
                </div>

                {issuedCreditNote && (
                  <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#9333ea', display: 'flex', justifyContent: 'space-between' }}>
                      <span>🎫 Credit Note Issued: {issuedCreditNote.credit_note_no}</span>
                      <span>₹{issuedCreditNote.amount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => printCreditNote({
                          creditNoteNo: issuedCreditNote.credit_note_no,
                          customerName: issuedCreditNote.customer_name || 'Customer',
                          customerPhone: issuedCreditNote.customer_phone,
                          amount: issuedCreditNote.amount,
                          balanceAmount: issuedCreditNote.balance_amount,
                          notes: issuedCreditNote.notes,
                          expiresAt: issuedCreditNote.expires_at,
                          createdAt: issuedCreditNote.created_at
                        })}
                        style={{ flex: 1, padding: '8px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        🖨️ Print Credit Note
                      </button>
                      {issuedCreditNote.customer_phone && (
                        <button
                          onClick={() => sendCreditNoteWhatsApp({
                            creditNoteNo: issuedCreditNote.credit_note_no,
                            customerName: issuedCreditNote.customer_name || 'Customer',
                            customerPhone: issuedCreditNote.customer_phone,
                            amount: issuedCreditNote.amount,
                            balanceAmount: issuedCreditNote.balance_amount,
                            expiresAt: issuedCreditNote.expires_at
                          })}
                          style={{ flex: 1, padding: '8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          💬 WhatsApp Voucher
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={() => { resetAll(); setIssuedCreditNote(null); setPageTab('history') }} style={{ ...btnOutline, width: '100%' }}>
                  <RotateCcw size={14} style={{ marginRight: '6px' }} /> New Transaction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
