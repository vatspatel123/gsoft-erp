import { User, X, Star, Banknote, CreditCard, Smartphone, BookOpen, History, Ticket } from 'lucide-react';
import type { Customer, Coupon, PaymentMode } from '../../hooks/usePOS';
import { type CustomerTier, getTierInfo } from '../../utils/customerTier';
import type { CreditNote } from '../../hooks/useCreditNotes';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveCustomerToCache } from '../../utils/offlineCache';
import toast from 'react-hot-toast';
import { fmtDate } from '../../utils/date'

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
  creditToApply?: number;
  setCreditToApply?: (amount: number) => void;
  creditNoteDiscount?: number;
  availableCredit?: number;
  maxApplicableCredit?: number;
  manualDiscount?: number;
  setManualDiscount?: (amount: number) => void;
  manualDiscountMode?: 'flat' | 'pct';
  setManualDiscountMode?: (mode: 'flat' | 'pct') => void;
  manualDiscountAmount?: number;
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
  tenders?: { cash: number; card: number; upi: number };
  setTender?: (kind: 'cash' | 'card' | 'upi', amount: number) => void;
  payFullBy?: (kind: 'cash' | 'card' | 'upi') => void;
  tenderTotal?: number;
  creditRemainder?: number;
  changeDue?: number;
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
  const remaining = Number(props.creditRemainder || 0)
  const changeDue = Number(props.changeDue || 0)

  const TENDERS = [
    { kind: 'cash' as const, label: 'Cash', icon: Banknote },
    { kind: 'card' as const, label: 'Card', icon: CreditCard },
    { kind: 'upi'  as const, label: 'UPI',  icon: Smartphone },
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

        {/* Coupon section hidden at client request. The coupon logic in usePOS is
            left intact, so restoring this block is all that's needed to re-enable it. */}

        {/* Credit Control Section */}
        {props.customer && (
          <div className="summary-section">
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9333ea' }}>
              <Ticket size={12} /> Credit Control
            </div>

            {(() => {
              const available = Number(props.availableCredit || 0)
              const maxUsable = Number(props.maxApplicableCredit || 0)
              const applied = Number(props.creditNoteDiscount || 0)
              const typed = Number(props.creditToApply || 0)

              if (available <= 0) {
                return (
                  <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 2px' }}>
                    No store credit available for this customer
                  </div>
                )
              }

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Available: ₹{available.toFixed(2)}</span>
                    <span style={{ color: '#94a3b8' }}>Usable here ₹{maxUsable.toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      value={typed > 0 ? typed : ''}
                      onChange={e => props.setCreditToApply?.(e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Credit to use"
                      style={{
                        flex: 1, minWidth: 0, border: '1px solid #f3e8ff', borderRadius: '8px',
                        padding: '8px 10px', fontSize: '13px', fontFamily: "'DM Mono', monospace",
                        outline: 'none', color: '#1a0a2e', background: 'white'
                      }}
                    />
                    <button
                      onClick={() => props.setCreditToApply?.(maxUsable)}
                      style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Use max
                    </button>
                    {typed > 0 && (
                      <button
                        onClick={() => props.setCreditToApply?.(0)}
                        style={{ background: 'none', border: 'none', color: '#a21caf', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {applied > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, color: '#9333ea', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Credit applied to this bill</span>
                      <span style={{ fontFamily: "'DM Mono', monospace" }}>-₹{applied.toFixed(2)}</span>
                    </div>
                  )}
                  {typed > maxUsable && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#f59e0b' }}>
                      Only ₹{maxUsable.toFixed(2)} can be used on this bill
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* Payment Mode */}
        <div className="summary-section">
          <div className="section-label">Payment Mode</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {TENDERS.map(({ kind, label, icon: Icon }) => {
              const amt = Number(props.tenders?.[kind] || 0)
              return (
                <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '74px', flexShrink: 0, fontSize: '12px', color: '#64748b' }}>
                    <Icon size={14} /> {label}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={amt > 0 ? amt : ''}
                    onChange={e => props.setTender?.(kind, e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    style={{
                      flex: 1, minWidth: 0, border: '1px solid #f3e8ff', borderRadius: '8px',
                      padding: '8px 10px', fontSize: '13px', fontFamily: "'DM Mono', monospace",
                      outline: 'none', color: '#1a0a2e', background: 'white'
                    }}
                  />
                  <button
                    onClick={() => props.payFullBy?.(kind)}
                    title={`Put the whole bill on ${label}`}
                    style={{
                      border: '1px solid #e9d5ff', background: '#faf5ff', color: '#9333ea', borderRadius: '8px',
                      padding: '8px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                    }}>
                    Full
                  </button>
                </div>
              )
            })}
          </div>

          {/* Allocation status — anything unallocated becomes udhar */}
          <div style={{
            marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '12px', fontWeight: 700, padding: '8px 10px', borderRadius: '8px',
            background: remaining > 0 ? '#fff7ed' : changeDue > 0 ? '#eff6ff' : '#f0fdf4',
            color: remaining > 0 ? '#b45309' : changeDue > 0 ? '#3b82f6' : '#16a34a'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {remaining > 0 ? <><BookOpen size={13} /> Remaining as pending</> : changeDue > 0 ? 'Change to return' : '✓ Fully paid'}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              ₹{(remaining > 0 ? remaining : changeDue).toFixed(2)}
            </span>
          </div>

          {/* Credit Sale (Pending / Pay Later) Due Date Terms */}
          {remaining > 0 && (
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
                  {props.creditDueDate ? fmtDate(new Date(props.creditDueDate)) : 'Not set'}
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

        {/* Change is shown in the Payment section, driven by the cash tender itself */}

        {/* Bill-level discount */}
        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Bill Discount
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid #f3e8ff', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              {(['flat', 'pct'] as const).map(m => {
                const active = (props.manualDiscountMode || 'flat') === m
                return (
                  <button
                    key={m}
                    onClick={() => props.setManualDiscountMode?.(m)}
                    style={{
                      border: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: '13px', fontWeight: 600,
                      background: active ? '#9333ea' : 'white', color: active ? 'white' : '#9333ea'
                    }}>
                    {m === 'flat' ? '₹' : '%'}
                  </button>
                )
              })}
            </div>
            <input
              type="number"
              min={0}
              value={Number(props.manualDiscount || 0) > 0 ? props.manualDiscount : ''}
              onChange={e => props.setManualDiscount?.(e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              style={{
                flex: 1, minWidth: 0, border: '1px solid #f3e8ff', borderRadius: '8px',
                padding: '8px 10px', fontSize: '13px', fontFamily: "'DM Mono', monospace",
                outline: 'none', color: '#1a0a2e', background: 'white'
              }}
            />
            {Number(props.manualDiscount || 0) > 0 && (
              <button
                onClick={() => props.setManualDiscount?.(0)}
                style={{ background: 'none', border: 'none', color: '#a21caf', cursor: 'pointer', padding: '4px' }}>
                <X size={16} />
              </button>
            )}
          </div>
          {Number(props.manualDiscountAmount || 0) > 0 && (
            <div style={{ marginTop: '5px', fontSize: '11px', fontWeight: 700, color: '#16a34a', display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount off this bill</span>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>-₹{Number(props.manualDiscountAmount || 0).toFixed(2)}</span>
            </div>
          )}
        </div>

        <button
          className="btn-complete"
          disabled={!canComplete}
          data-enter-submit
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
