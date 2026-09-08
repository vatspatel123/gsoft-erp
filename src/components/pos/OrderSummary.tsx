import { User, X, Star, Banknote, CreditCard, Smartphone, BookOpen, History, Ticket } from 'lucide-react';
import type { Customer, Coupon, PaymentMode } from '../../hooks/usePOS';
import { type CustomerTier, getTierInfo } from '../../utils/customerTier';
import type { CreditNote } from '../../hooks/useCreditNotes';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveCustomerToCache } from '../../utils/offlineCache';
import toast from 'react-hot-toast';

interface OrderSummaryProps {
  customer: Customer | null;
  onCustomerFound: (customer: Customer | null) => void;
  removeCustomer: () => void;
  searchCustomer?: (phone: string) => void;
  customerNotFound?: boolean;
  searchedPhone: string;
  addCustomer: (details: { name: string, email: string, date_of_birth: string }) => void;
  skipCustomer: () => void;
  customerTier?: CustomerTier;
  activeCreditNotes?: CreditNote[];
  appliedCreditNote?: CreditNote | null;
  applyCreditNote?: (note: CreditNote) => void;
  removeCreditNote?: () => void;
  creditNoteDiscount?: number;
  onViewHistory?: (customer: Customer) => void;
  couponCode: string;
  setCouponCode: (c: string) => void;
  applyCoupon: () => void;
  coupon: Coupon | null;
  removeCoupon: () => void;
  loyaltyToRedeem: number;
  setLoyaltyToRedeem: (pts: number) => void;
  maxRedeemable: number;
  paymentMode: PaymentMode;
  setPaymentMode: (m: PaymentMode) => void;
  creditDueDays?: number;
  setCreditDueDays?: (days: number) => void;
  creditDueDate?: string;
  setCreditDueDate?: (date: string) => void;
  subtotal: number;
  gstAmount: number;
  totalDiscount: number;
  netAmount: number;
  completeSale: () => void;
  isSaving: boolean;
  clearCart: () => void;
  cartLength: number;
}

export function OrderSummary(props: OrderSummaryProps) {
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newBirthday, setNewBirthday] = useState('')
  const [cashReceived, setCashReceived] = useState('')

  const change = props.paymentMode === 'cash' && cashReceived
    ? parseFloat(cashReceived) - props.netAmount
    : null

  const PAYMENT_MODES = [
    { mode: 'cash',   label: 'Cash',   icon: Banknote },
    { mode: 'card',   label: 'Card',   icon: CreditCard },
    { mode: 'upi',    label: 'UPI',    icon: Smartphone },
    { mode: 'credit', label: 'Credit', icon: BookOpen },
  ]

  const searchCustomers = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }
    setCustomerLoading(true)
    let fetchedFromDb = false;
    
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
          .order('name')
          .limit(8)
          
        if (!error && data) {
          setCustomerResults(data)
          setShowCustomerDropdown(true)
          fetchedFromDb = true
        }
      } catch (e) {
        console.warn('Network error while searching customers in DB:', e)
      }
    }
    
    if (!fetchedFromDb) {
      // Offline or DB error: search cache
      try {
        const raw = localStorage.getItem('gsoft_customers_cache')
        const all = raw ? JSON.parse(raw).data || [] : []
        const q = query.toLowerCase()
        const filtered = all.filter((c: any) =>
          c.phone?.includes(query) || c.name?.toLowerCase().includes(q)
        ).slice(0, 8)
        setCustomerResults(filtered)
        setShowCustomerDropdown(true)
      } catch (e) {
        setCustomerResults([])
      }
    }
    setCustomerLoading(false)
  }

  // Debounced search
  useEffect(() => {
    if (!customerSearch.trim() || props.customer) return
    const timer = setTimeout(() => {
      if (customerSearch.trim().length >= 2) {
        searchCustomers(customerSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const handleSelectCustomer = (c: any) => {
    props.onCustomerFound(c)
    setCustomerSearch(c.name + ' — ' + c.phone)
    setShowCustomerDropdown(false)
    setShowNewForm(false)
  }

  const handleSaveNewCustomer = async () => {
    const phone = customerSearch.replace(/\D/g, '')
    if (!phone || phone.length < 10) {
      toast.error('Enter valid 10 digit phone number')
      return
    }

    const newCustomer = {
      id: crypto.randomUUID(),
      name: newName.trim() || 'Customer',
      phone: phone,
      email: newEmail || null,
      date_of_birth: newBirthday || null,
      loyalty_points: 0,
      total_spent: 0,
      referral_code: Math.random().toString(36).substring(2, 10),
      created_at: new Date().toISOString()
    }

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .insert({
            id: newCustomer.id,
            name: newCustomer.name,
            phone: newCustomer.phone,
            email: newCustomer.email,
            date_of_birth: newCustomer.date_of_birth,
            loyalty_points: 0,
            total_spent: 0,
            referral_code: newCustomer.referral_code
          })
          .select()
          .single()

        if (!error && data) {
          saveCustomerToCache(data)
          props.onCustomerFound(data)
          setCustomerSearch(data.name + ' — ' + data.phone)
          setShowCustomerDropdown(false)
          setShowNewForm(false)
          toast.success('Customer saved! ✅')
          return
        }
      } catch (err) {
        console.warn('DB customer save notice, using local customer:', err)
      }
    }

    // Save to local cache as fallback
    saveCustomerToCache(newCustomer)
    props.onCustomerFound(newCustomer)
    setCustomerSearch(newCustomer.name + ' — ' + newCustomer.phone)
    setShowCustomerDropdown(false)
    setShowNewForm(false)
    toast.success('Customer saved! ✅')
  }

  const canComplete = props.cartLength > 0 && !props.isSaving && !!props.customer

  return (
    <div className="order-summary">
      <div className="summary-scroll">

        {/* Customer Section */}
        <div className="summary-section">
          <div style={{
            fontSize: '10px', fontWeight: 600, color: '#9333ea',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <User size={11} /> Customer
            <span style={{
              background: '#fef2f2', color: '#ef4444',
              fontSize: '9px', padding: '1px 6px', borderRadius: '99px', fontWeight: 600
            }}>Required *</span>
          </div>

          {props.customer ? (
            /* Selected customer card */
            <div className="customer-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar">
                  {props.customer.name?.charAt(0).toUpperCase()}
                </div>
                <div className="info" style={{ flex: 1 }}>
                  <div className="c-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {props.customer.name}
                    {props.customerTier && (() => {
                      const tInfo = getTierInfo(props.customerTier)
                      return (
                        <span style={{
                          background: tInfo.badgeBg,
                          color: tInfo.badgeText,
                          border: `1px solid ${tInfo.borderColor}`,
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '99px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {tInfo.icon} {tInfo.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="c-phone">
                    {props.customer.phone}
                    {props.customer.loyalty_points > 0 && (
                      <span className="loyalty-badge" style={{ marginLeft: '8px', marginTop: 0 }}>
                        <Star size={10} style={{ display: 'inline', verticalAlign: 'middle' }} fill="currentColor" /> {props.customer.loyalty_points} pts
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    props.onCustomerFound(null)
                    setCustomerSearch('')
                    setCustomerResults([])
                  }}
                  className="remove-c"
                >×</button>
              </div>

              {/* History button */}
              {props.onViewHistory && (
                <button
                  onClick={() => props.onViewHistory?.(props.customer!)}
                  style={{
                    background: '#fdf4ff', border: '1px solid #f0abfc',
                    borderRadius: '8px', padding: '5px 10px', color: '#9333ea',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                  }}>
                  <History size={12} /> View 360° Customer Ledger & History
                </button>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Search input */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'white',
                border: `1px solid ${showCustomerDropdown ? '#c084fc' : '#f3e8ff'}`,
                borderRadius: '10px', padding: '0 12px',
                boxShadow: showCustomerDropdown ? '0 0 0 3px #f5f3ff' : 'none',
                transition: 'all 0.15s'
              }}>
                <span style={{ fontSize: '14px' }}>📱</span>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value)
                    if (!e.target.value.trim()) {
                      setCustomerResults([])
                      setShowCustomerDropdown(false)
                      setShowNewForm(false)
                    }
                  }}
                  onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true) }}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      searchCustomers(customerSearch)
                    }
                    if (e.key === 'Escape') setShowCustomerDropdown(false)
                  }}
                  placeholder="Phone number or name..."
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    padding: '10px 0', fontSize: '13px',
                    fontFamily: 'DM Sans, sans-serif',
                    background: 'transparent', color: '#1a0a2e'
                  }}
                />
                {customerLoading && (
                  <div style={{
                    width: '14px', height: '14px',
                    border: '2px solid #f3e8ff', borderTopColor: '#9333ea',
                    borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0
                  }} />
                )}
                {customerSearch && !customerLoading && (
                  <button
                    onClick={() => {
                      setCustomerSearch('')
                      setCustomerResults([])
                      setShowCustomerDropdown(false)
                      setShowNewForm(false)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px', padding: 0, lineHeight: 1 }}
                  >×</button>
                )}
              </div>

              {/* Results dropdown */}
              {showCustomerDropdown && customerResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  zIndex: 9999, background: 'white',
                  border: '1px solid #f3e8ff', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(147,51,234,0.12)',
                  overflow: 'hidden', maxHeight: '240px', overflowY: 'auto'
                }}>
                  {customerResults.map((c, i) => (
                    <div
                      key={c.id}
                      onMouseDown={() => handleSelectCustomer(c)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: i < customerResults.length - 1 ? '1px solid #fdf8ff' : 'none',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#f5f3ff', color: '#9333ea',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 600, flexShrink: 0
                      }}>
                        {c.name?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                          {c.phone}
                          {c.loyalty_points > 0 && (
                            <span style={{ marginLeft: '8px', color: '#f97316' }}>⭐ {c.loyalty_points} pts</span>
                          )}
                        </div>
                      </div>
                      {c.total_spent > 10000 && (
                        <span style={{
                          fontSize: '10px', background: '#fffbeb', color: '#f59e0b',
                          padding: '2px 6px', borderRadius: '99px', fontWeight: 600
                        }}>👑 VIP</span>
                      )}
                    </div>
                  ))}
                  <div
                    onMouseDown={() => { setShowCustomerDropdown(false); setShowNewForm(true) }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: '#f5f3ff', display: 'flex', alignItems: 'center',
                      gap: '8px', fontSize: '13px', color: '#9333ea', fontWeight: 500
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ede9fe')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f5f3ff')}
                  >
                    + Add as new customer
                  </div>
                </div>
              )}

              {/* No results dropdown */}
              {showCustomerDropdown && customerResults.length === 0 && customerSearch.length >= 2 && !customerLoading && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  zIndex: 9999, background: 'white',
                  border: '1px solid #f3e8ff', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(147,51,234,0.12)', overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 14px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                    No customer found
                  </div>
                  <div
                    onMouseDown={() => { setShowCustomerDropdown(false); setShowNewForm(true) }}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: '#f5f3ff', display: 'flex', alignItems: 'center',
                      gap: '8px', fontSize: '13px', color: '#9333ea', fontWeight: 500,
                      borderTop: '1px solid #f3e8ff'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ede9fe')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f5f3ff')}
                  >
                    + Add as new customer
                  </div>
                </div>
              )}

              {/* New customer form */}
              {showNewForm && (
                <div className="new-customer-form" style={{ marginTop: '8px' }}>
                  <div className="new-cust-heading">
                    New customer — all fields optional
                  </div>
                  <input
                    type="text"
                    placeholder="Customer name"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: '8px' }}
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: '8px' }}
                  />
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>🎂 Birthday (optional)</div>
                  <input
                    type="date"
                    value={newBirthday}
                    onChange={e => setNewBirthday(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveNewCustomer}
                      className="btn-save-cust"
                      style={{ margin: 0 }}
                    >
                      Save & Continue
                    </button>
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="btn-skip-cust"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coupon Section */}
        <div className="summary-section">
          <div className="section-label">Coupon</div>
          {!props.coupon ? (
            <div className="coupon-input">
              <input
                placeholder="Enter Code"
                value={props.couponCode}
                onChange={e => props.setCouponCode(e.target.value)}
              />
              <button onClick={props.applyCoupon}>Apply</button>
            </div>
          ) : (
            <div className="coupon-active">
              <div>
                <div className="code">{props.coupon.code} APPLIED</div>
                <div className="saving" style={{ fontFamily: "'DM Mono', monospace" }}>Saving ₹{props.totalDiscount.toFixed(2)}</div>
              </div>
              <button className="remove-coupon" onClick={props.removeCoupon}><X size={16}/></button>
            </div>
          )}
        </div>

        {/* Credit Note Section */}
        {props.customer && (props.activeCreditNotes && props.activeCreditNotes.length > 0 || props.appliedCreditNote) && (
          <div className="summary-section">
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9333ea' }}>
              <Ticket size={12} /> Store Credit Note
            </div>

            {props.appliedCreditNote ? (
              <div style={{
                background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '10px',
                padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#9333ea' }}>
                    {props.appliedCreditNote.credit_note_no}
                  </div>
                  <div style={{ fontSize: '11px', color: '#701a75' }}>
                    Applying ₹{Number(props.creditNoteDiscount || 0).toFixed(2)} of ₹{props.appliedCreditNote.balance_amount.toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={props.removeCreditNote}
                  style={{ background: 'none', border: 'none', color: '#a21caf', cursor: 'pointer', padding: '4px' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {props.activeCreditNotes?.map(cn => (
                  <div key={cn.id} style={{
                    background: '#f8fafc', border: '1px dashed #c084fc', borderRadius: '10px',
                    padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                        {cn.credit_note_no}
                      </div>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                        Available: ₹{cn.balance_amount.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => props.applyCreditNote?.(cn)}
                      style={{
                        background: '#9333ea', color: 'white', border: 'none',
                        borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}>
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loyalty Section */}
        {props.customer && props.customer.loyalty_points > 0 && props.maxRedeemable > 0 && (
          <div className="summary-section">
            <div className="section-label">Redeem Loyalty Points</div>
            <div className="loyalty-slider-wrap">
              <label>
                <span>Redeeming {props.loyaltyToRedeem} pts</span>
                <span style={{ color: '#9333ea', fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>-₹{(props.loyaltyToRedeem * 0.25).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max={props.maxRedeemable}
                step="1"
                value={props.loyaltyToRedeem}
                onChange={e => props.setLoyaltyToRedeem(parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {/* Payment Mode */}
        <div className="summary-section">
          <div className="section-label">Payment Mode</div>
          <div className="payment-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PAYMENT_MODES.map(({ mode, label, icon: Icon }) => {
              const isActive = props.paymentMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => props.setPaymentMode(mode as PaymentMode)}
                  style={isActive ? {
                    background: '#9333ea', color: 'white', border: 'none',
                    height: '38px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(147,51,234,0.2)'
                  } : {
                    background: 'white', border: '1px solid #f3e8ff', color: '#64748b',
                    height: '38px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Credit Sale (Udhar / Pay Later) Due Date Terms */}
          {props.paymentMode === 'credit' && (
            <div style={{
              marginTop: '10px', background: '#faf5ff', border: '1px solid #e9d5ff',
              borderRadius: '10px', padding: '10px 12px'
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: '#9333ea',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '6px'
              }}>
                <span>📅 Promised Payment Term (ઉધાર)</span>
                <span style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 600 }}>
                  {props.creditDueDays ? `Due in ${props.creditDueDays} Days` : 'Custom Date'}
                </span>
              </div>

              {/* Preset buttons */}
              <div className="credit-due-presets">
                {[
                  { days: 5, label: '5 Days (૫ દિવસ)' },
                  { days: 7, label: '7 Days' },
                  { days: 15, label: '15 Days' },
                  { days: 30, label: '30 Days' },
                ].map(({ days, label }) => {
                  const isSel = props.creditDueDays === days
                  return (
                    <button
                      key={days}
                      type="button"
                      className={`credit-due-btn ${isSel ? 'active' : ''}`}
                      onClick={() => {
                        props.setCreditDueDays?.(days)
                        const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
                        props.setCreditDueDate?.(d.toISOString().slice(0, 10))
                      }}
                      style={isSel ? { background: '#9333ea', color: 'white', borderColor: '#9333ea' } : {}}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Custom date input & formatted due summary */}
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="date"
                  value={props.creditDueDate || ''}
                  onChange={e => {
                    const newDateStr = e.target.value
                    props.setCreditDueDate?.(newDateStr)
                    if (newDateStr) {
                      const diffTime = new Date(newDateStr).getTime() - new Date().setHours(0,0,0,0)
                      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
                      props.setCreditDueDays?.(diffDays)
                    }
                  }}
                  style={{
                    flex: 1, border: '1px solid #e9d5ff', borderRadius: '6px',
                    padding: '5px 8px', fontSize: '11px', outline: 'none',
                    background: 'white', color: '#1a0a2e'
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: '#6b21a8', marginTop: '6px', fontWeight: 500 }}>
                ⚠️ Payment Due Date: <strong style={{ color: '#9333ea' }}>
                  {props.creditDueDate ? new Date(props.creditDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'}
                </strong> ({props.creditDueDays || 0} days remaining)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Totals & Actions */}
      <div className="totals-section">
        <div className="tot-row">
          <span>Subtotal</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>₹{props.subtotal.toFixed(2)}</span>
        </div>
        <div className="tot-row">
          <span>GST</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>₹{props.gstAmount.toFixed(2)}</span>
        </div>
        {props.totalDiscount > 0 && (
          <div className="tot-row discount-row">
            <span>Discount</span>
            <span style={{ fontFamily: "'DM Mono', monospace" }}>-₹{props.totalDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="tot-row net-row">
          <span>Net Payable</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>₹{props.netAmount.toFixed(2)}</span>
        </div>

        {/* Cash change calculator */}
        {props.paymentMode === 'cash' && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="number"
                placeholder="Cash received"
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                style={{
                  flex: 1, border: '1px solid #f3e8ff', borderRadius: '8px',
                  padding: '8px 12px', fontSize: '13px',
                  fontFamily: "'DM Mono', monospace",
                  outline: 'none', color: '#1a0a2e', background: 'white'
                }}
              />
            </div>
            {change !== null && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '13px', fontWeight: 600, padding: '6px 10px',
                borderRadius: '8px',
                background: change >= 0 ? '#f0fdf4' : '#fef2f2',
                color: change >= 0 ? '#16a34a' : '#ef4444'
              }}>
                <span>Change</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>
                  {change >= 0 ? `₹${change.toFixed(2)}` : `Short ₹${Math.abs(change).toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          className="btn-complete"
          disabled={!canComplete}
          onClick={props.completeSale}
          style={{
            background: canComplete ? '#9333ea' : '#e9d5ff',
            cursor: canComplete ? 'pointer' : 'not-allowed'
          }}
        >
          {props.isSaving ? 'Processing...' : (
            <span>
              Complete Sale · <span style={{ fontFamily: "'DM Mono', monospace" }}>₹{props.netAmount.toFixed(2)}</span>
            </span>
          )}
        </button>

        {!props.customer && props.cartLength > 0 && (
          <div style={{
            textAlign: 'center', fontSize: '11px', color: '#ef4444',
            marginTop: '6px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '4px'
          }}>
            📱 Add customer to complete sale
          </div>
        )}

        <button className="btn-new-sale" onClick={props.clearCart}>
          ↺ New Sale
        </button>
      </div>
    </div>
  )
}
