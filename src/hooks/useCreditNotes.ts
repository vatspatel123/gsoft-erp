import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface CreditNote {
  id: string
  credit_note_no: string
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  original_sale_id?: string
  amount: number
  balance_amount: number
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
  notes?: string
  expires_at?: string
  created_at: string
}

const LOCAL_CN_KEY = 'gsoft_credit_notes_cache'

export function useCreditNotes() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('credit_notes')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data) {
          setCreditNotes(data)
          try {
            localStorage.setItem(LOCAL_CN_KEY, JSON.stringify(data))
          } catch {}
          setLoading(false)
          return
        }
      }
      // Offline fallback
      const cached = localStorage.getItem(LOCAL_CN_KEY)
      if (cached) {
        setCreditNotes(JSON.parse(cached))
      }
    } catch (err) {
      console.warn('Credit notes fetch notice:', err)
      const cached = localStorage.getItem(LOCAL_CN_KEY)
      if (cached) setCreditNotes(JSON.parse(cached))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCreditNotes()
  }, [fetchCreditNotes])

  const generateCNNumber = async () => {
    const year = new Date().getFullYear()
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    return `CN-${year}-${randomSuffix}`
  }

  const issueCreditNote = async (params: {
    customer_id?: string
    customer_name?: string
    customer_phone?: string
    original_sale_id?: string
    amount: number
    notes?: string
    expires_in_days?: number
  }): Promise<CreditNote | null> => {
    const cnNo = await generateCNNumber()
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + (params.expires_in_days || 90))

    const newNote: CreditNote = {
      id: crypto.randomUUID(),
      credit_note_no: cnNo,
      customer_id: params.customer_id,
      customer_name: params.customer_name || 'Customer',
      customer_phone: params.customer_phone,
      original_sale_id: params.original_sale_id,
      amount: Number(params.amount),
      balance_amount: Number(params.amount),
      status: 'active',
      notes: params.notes || 'Exchange return balance store credit',
      expires_at: expiryDate.toISOString(),
      created_at: new Date().toISOString()
    }

    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('credit_notes').insert(newNote)
        if (error) {
          console.warn('DB credit note insert warning (table might be missing):', error.message)
        }
      } catch (e) {
        console.warn('Network issue saving credit note to DB:', e)
      }
    }

    // Always update local state & cache
    const updated = [newNote, ...creditNotes]
    setCreditNotes(updated)
    try {
      localStorage.setItem(LOCAL_CN_KEY, JSON.stringify(updated))
    } catch {}

    toast.success(`🎫 Credit Note ${cnNo} issued for ₹${params.amount}!`)
    return newNote
  }

  const getCustomerCreditBalance = useCallback((customerIdOrPhone?: string): { totalBalance: number; activeNotes: CreditNote[] } => {
    if (!customerIdOrPhone) return { totalBalance: 0, activeNotes: [] }
    const clean = customerIdOrPhone.trim()

    const activeNotes = creditNotes.filter(cn => {
      if (cn.status !== 'active' || cn.balance_amount <= 0) return false
      return (
        cn.customer_id === clean ||
        (cn.customer_phone && cn.customer_phone.includes(clean))
      )
    })

    const totalBalance = activeNotes.reduce((sum, n) => sum + (n.balance_amount || 0), 0)
    return { totalBalance, activeNotes }
  }, [creditNotes])

  const redeemCreditNote = async (creditNoteId: string, amountToRedeem: number): Promise<boolean> => {
    const note = creditNotes.find(n => n.id === creditNoteId)
    if (!note || note.balance_amount < amountToRedeem) {
      toast.error('Invalid credit note redemption')
      return false
    }

    const newBalance = Math.max(0, note.balance_amount - amountToRedeem)
    const newStatus = newBalance === 0 ? 'redeemed' : 'active'

    if (navigator.onLine) {
      try {
        await supabase
          .from('credit_notes')
          .update({ balance_amount: newBalance, status: newStatus })
          .eq('id', creditNoteId)
      } catch (e) {
        console.warn('DB credit note update notice:', e)
      }
    }

    const updated = creditNotes.map(n =>
      n.id === creditNoteId ? { ...n, balance_amount: newBalance, status: newStatus as any } : n
    )
    setCreditNotes(updated)
    try {
      localStorage.setItem(LOCAL_CN_KEY, JSON.stringify(updated))
    } catch {}

    toast.success(`Redeemed ₹${amountToRedeem} from Credit Note ${note.credit_note_no}`)
    return true
  }

  return {
    creditNotes,
    loading,
    fetchCreditNotes,
    issueCreditNote,
    getCustomerCreditBalance,
    redeemCreditNote
  }
}
