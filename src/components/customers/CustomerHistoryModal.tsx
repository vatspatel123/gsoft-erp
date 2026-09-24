import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Receipt, ArrowLeftRight, Ticket, Clock, Star, Phone, MessageCircle, Printer, AlertTriangle } from 'lucide-react'
import { calculateCustomerTier, getTierInfo, type CustomerTier } from '../../utils/customerTier'
import { printCreditNote, sendCreditNoteWhatsApp } from '../../utils/printBill'
import toast from 'react-hot-toast'
import { sendWhatsApp } from '../../utils/whatsapp'

interface CustomerHistoryModalProps {
  customer: {
    id: string
    name: string
    phone: string
    email?: string | null
    loyalty_points?: number
    total_spent?: number
    created_at?: string
  }
  onClose: () => void
}

export function CustomerHistoryModal({ customer, onClose }: CustomerHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'exchanges' | 'credit_notes' | 'credit_dues'>('sales')
  const [sales, setSales] = useState<any[]>([])
  const [exchanges, setExchanges] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

  useEffect(() => {
    const loadCustomerData = async () => {
      setLoading(true)
      try {
        if (navigator.onLine && customer.id) {
          // 1. Fetch Sales with items
          const { data: salesData } = await supabase
            .from('sales')
            .select(`
              id, invoice_no, total_amount, discount_amount, net_amount, gst_amount, payment_mode, created_at, is_return,
              sale_items (id, qty, unit_price, discount_pct, line_total, products (name, size, colour, sku, barcode))
            `)
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false })

          if (salesData) setSales(salesData)

          // 2. Fetch Exchanges
          const { data: excData } = await supabase
            .from('exchange_bills')
            .select('*')
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false })

          if (excData) setExchanges(excData)

          // 3. Fetch Credit Notes
          const { data: cnData } = await supabase
            .from('credit_notes')
            .select('*')
            .or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone}`)
            .order('created_at', { ascending: false })

          if (cnData) setCreditNotes(cnData)
        } else {
          // Local cache fallback
          const localCNs = localStorage.getItem('gsoft_credit_notes_cache')
          if (localCNs) {
            const parsed = JSON.parse(localCNs)
            setCreditNotes(parsed.filter((c: any) => c.customer_id === customer.id || c.customer_phone === customer.phone))
          }
        }
      } catch (err) {
        console.warn('History modal fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCustomerData()
  }, [customer])

  // Aggregate stats
  const totalBillsCount = sales.filter(s => !s.is_return).length
  const maxSingleBill = sales.length > 0 ? Math.max(...sales.map(s => s.net_amount || 0)) : 0
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const yearlySpent = sales
    .filter(s => !s.is_return && s.created_at >= oneYearAgo)
    .reduce((sum, s) => sum + (s.net_amount || 0), 0)
  const lifetimeSpent = sales
    .filter(s => !s.is_return)
    .reduce((sum, s) => sum + (s.net_amount || 0), 0) || customer.total_spent || 0

  const tier: CustomerTier = calculateCustomerTier({
    billsCount: totalBillsCount,
    maxSingleBill,
    yearlySpent,
    lifetimeSpent
  })
  const tierInfo = getTierInfo(tier)

  const activeCreditBalance = creditNotes
    .filter(cn => cn.status === 'active' && cn.balance_amount > 0)
    .reduce((sum, cn) => sum + Number(cn.balance_amount || 0), 0)

  const unpaidCreditSales = sales.filter(s => s.payment_mode === 'credit' && !s.is_return)
  const totalUnpaidCredit = unpaidCreditSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)

  const sendWhatsAppLedger = () => {
    if (!customer.phone) {
      toast.error('Customer phone number not available')
      return
    }
    const cleanPhone = customer.phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const msg =
      `*🏛️ CUSTOMER ACCOUNT STATEMENT*%0A%0A` +
      `Customer: *${customer.name}*%0A` +
      `Membership Tier: *${tierInfo.icon} ${tierInfo.label}*%0A` +
      `• Total Visits / Bills: ${totalBillsCount}%0A` +
      `• Total Lifetime Purchases: ₹${lifetimeSpent.toLocaleString('en-IN')}%0A` +
      `• Loyalty Points: ${customer.loyalty_points || 0} pts%0A` +
      (activeCreditBalance > 0 ? `• Store Credit Available: ₹${activeCreditBalance.toFixed(2)}%0A` : '') +
      (totalUnpaidCredit > 0 ? `• Outstanding Credit Balance: ₹${totalUnpaidCredit.toFixed(2)}%0A` : '') +
      `%0AThank you for being our valued customer!`

    sendWhatsApp(fullPhone, msg, { encoded: true })
  }

  const send15DayOverdueReminder = (sale: any) => {
    if (!customer.phone) {
      toast.error('Customer phone number not available')
      return
    }
    const cleanPhone = customer.phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const dateStr = new Date(sale.created_at).toLocaleDateString('en-IN')
    const msg =
      `*🔔 PAYMENT REMINDER — OUTSTANDING BILL*%0A%0A` +
      `નમસ્તે *${customer.name}*,%0A` +
      `આપનું બિલ નંબર *#${sale.invoice_no}* (તારીખ: ${dateStr}) નું બાકી રકમ *₹${Number(sale.net_amount).toFixed(2)}* છે.%0A` +
      `કૃપા કરીને વહેલી તકે ચુકવણી કરશો.%0A%0A` +
      `_Dear ${customer.name}, gentle reminder regarding your outstanding bill #${sale.invoice_no} of ₹${Number(sale.net_amount).toFixed(2)} dated ${dateStr}._%0A` +
      `Thank you!`

    sendWhatsApp(fullPhone, msg, { encoded: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 99999, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', width: '100%',
        maxWidth: '850px', maxHeight: '90vh', display: 'flex',
        flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          borderBottom: '1px solid #e9d5ff', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: '#9333ea', color: 'white', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              fontWeight: 800, boxShadow: '0 4px 12px rgba(147,51,234,0.3)'
            }}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e1b4b' }}>
                  {customer.name}
                </h2>
                <span style={{
                  background: tierInfo.badgeBg, color: tierInfo.badgeText,
                  border: `1px solid ${tierInfo.borderColor}`, fontSize: '11px',
                  padding: '2px 8px', borderRadius: '99px', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  {tierInfo.icon} {tierInfo.label}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '12px' }}>
                <span>📱 {customer.phone}</span>
                {customer.email && <span>✉️ {customer.email}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={sendWhatsAppLedger}
              style={{
                background: '#16a34a', color: 'white', border: 'none',
                borderRadius: '10px', padding: '8px 14px', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '6px'
              }}>
              <MessageCircle size={14} /> Send Statement
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
                width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
          padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LIFETIME PURCHASES</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#9333ea', marginTop: '2px' }}>
              ₹{lifetimeSpent.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{totalBillsCount} Invoices</div>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LOYALTY POINTS</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
              ⭐ {customer.loyalty_points || 0} pts
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Worth ₹{((customer.loyalty_points || 0) * 0.25).toFixed(2)}</div>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>STORE CREDIT BALANCE</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
              🎫 ₹{activeCreditBalance.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Redeemable in POS</div>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>OUTSTANDING CREDIT</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: totalUnpaidCredit > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
              ₹{totalUnpaidCredit.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{unpaidCreditSales.length} Unpaid Bills</div>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px',
          background: 'white', gap: '8px'
        }}>
          {[
            { key: 'sales', label: `Invoices (${sales.length})`, icon: Receipt },
            { key: 'exchanges', label: `Exchanges (${exchanges.length})`, icon: ArrowLeftRight },
            { key: 'credit_notes', label: `Credit Notes (${creditNotes.length})`, icon: Ticket },
            { key: 'credit_dues', label: `Overdue Dues (${unpaidCreditSales.length})`, icon: AlertTriangle }
          ].map(t => {
            const Icon = t.icon
            const isSel = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 14px',
                  border: 'none', background: 'none', borderBottom: isSel ? '2px solid #9333ea' : '2px solid transparent',
                  color: isSel ? '#9333ea' : '#64748b', fontWeight: isSel ? 700 : 500,
                  fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s'
                }}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Body content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#ffffff' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading ledger history...</div>
          ) : (
            <>
              {/* TAB 1: INVOICES */}
              {activeTab === 'sales' && (
                <div>
                  {sales.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No purchase invoices recorded yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sales.map(s => {
                        const isExpanded = expandedSaleId === s.id
                        const dateStr = new Date(s.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })
                        return (
                          <div key={s.id} style={{
                            border: '1px solid #f1f5f9', borderRadius: '12px', padding: '14px',
                            background: '#faf5ff'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e1b4b' }}>
                                  {s.invoice_no}
                                  <span style={{
                                    marginLeft: '8px', fontSize: '10px', padding: '2px 6px',
                                    borderRadius: '99px', fontWeight: 600,
                                    background: s.payment_mode === 'credit' ? '#fef2f2' : '#dcfce7',
                                    color: s.payment_mode === 'credit' ? '#dc2626' : '#166534'
                                  }}>
                                    {s.payment_mode?.toUpperCase()}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  {dateStr}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>
                                  ₹{Number(s.net_amount).toFixed(2)}
                                </div>
                                <button
                                  onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                                  style={{
                                    background: 'none', border: 'none', color: '#9333ea',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0
                                  }}>
                                  {isExpanded ? 'Hide items ▲' : `View items (${s.sale_items?.length || 0}) ▼`}
                                </button>
                              </div>
                            </div>

                            {/* Expanded items list */}
                            {isExpanded && s.sale_items && s.sale_items.length > 0 && (
                              <div style={{ marginTop: '12px', borderTop: '1px dashed #e9d5ff', paddingTop: '10px' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', fontSize: '10px', textAlign: 'left' }}>
                                      <th style={{ padding: '4px 0' }}>Item</th>
                                      <th style={{ padding: '4px 0', textAlign: 'center' }}>Qty</th>
                                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Rate</th>
                                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.sale_items.map((item: any, idx: number) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f3e8ff' }}>
                                        <td style={{ padding: '6px 0', fontWeight: 500 }}>
                                          {item.products?.name || 'Item'}
                                          {item.products?.size && <span style={{ color: '#9333ea', marginLeft: '4px' }}>({item.products.size})</span>}
                                        </td>
                                        <td style={{ padding: '6px 0', textAlign: 'center' }}>{item.qty}</td>
                                        <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{Number(item.unit_price).toFixed(2)}</td>
                                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#9333ea' }}>
                                          ₹{Number(item.line_total).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EXCHANGES */}
              {activeTab === 'exchanges' && (
                <div>
                  {exchanges.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No exchange transactions found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {exchanges.map(exc => (
                        <div key={exc.id} style={{
                          border: '1px solid #f1f5f9', borderRadius: '12px', padding: '14px',
                          background: '#faf5ff'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e1b4b' }}>
                                {exc.exchange_no}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Orig. Invoice: #{exc.original_invoice_no} · {new Date(exc.created_at).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '12px', color: '#ef4444' }}>
                                Return: -₹{Number(exc.return_amount).toFixed(2)}
                              </div>
                              <div style={{ fontSize: '12px', color: '#16a34a' }}>
                                New Items: +₹{Number(exc.new_sale_amount).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CREDIT NOTES */}
              {activeTab === 'credit_notes' && (
                <div>
                  {creditNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No store credit notes issued.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {creditNotes.map(cn => (
                        <div key={cn.id} style={{
                          border: '1px solid #f0abfc', borderRadius: '12px', padding: '14px',
                          background: '#fdf4ff', display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '14px', color: '#9333ea' }}>
                                🎫 {cn.credit_note_no}
                              </span>
                              <span style={{
                                fontSize: '10px', padding: '2px 8px', borderRadius: '99px',
                                fontWeight: 700,
                                background: cn.status === 'active' ? '#dcfce7' : '#fee2e2',
                                color: cn.status === 'active' ? '#166534' : '#991b1b'
                              }}>
                                {cn.status?.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                              Issued on {new Date(cn.created_at).toLocaleDateString('en-IN')} · Original: ₹{Number(cn.amount).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>AVAILABLE BALANCE</div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a', fontFamily: 'DM Mono, monospace' }}>
                                ₹{Number(cn.balance_amount).toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => printCreditNote({
                                creditNoteNo: cn.credit_note_no,
                                customerName: customer.name,
                                customerPhone: customer.phone,
                                amount: cn.amount,
                                balanceAmount: cn.balance_amount,
                                notes: cn.notes,
                                expiresAt: cn.expires_at,
                                createdAt: cn.created_at
                              })}
                              style={{
                                background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
                                padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                              }}>
                              <Printer size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CREDIT DUES & ADVANCE CREDIT */}
              {activeTab === 'credit_dues' && (
                <div>
                  {unpaidCreditSales.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#16a34a' }}>
                      🎉 Zero unpaid credit bills! Customer has no pending dues.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {unpaidCreditSales.map(s => {
                        const billDate = new Date(s.created_at)
                        const daysAgo = Math.floor((Date.now() - billDate.getTime()) / (1000 * 60 * 60 * 24))
                        
                        let dueDateText = ''
                        let isOverdue = false
                        let statusBadge = ''
                        
                        if (s.credit_due_date) {
                          const dueTime = new Date(s.credit_due_date).getTime()
                          const nowTime = new Date().setHours(0,0,0,0)
                          const daysUntilDue = Math.ceil((dueTime - nowTime) / (1000 * 60 * 60 * 24))
                          dueDateText = new Date(s.credit_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          if (daysUntilDue < 0) {
                            isOverdue = true
                            statusBadge = `⚠️ Overdue by ${Math.abs(daysUntilDue)} days`
                          } else if (daysUntilDue === 0) {
                            isOverdue = true
                            statusBadge = `🔔 Due Today!`
                          } else {
                            statusBadge = `⏳ Due in ${daysUntilDue} days`
                          }
                        } else {
                          isOverdue = daysAgo >= 15
                          statusBadge = isOverdue ? '⚠️ 15+ Days Overdue' : `${daysAgo} days ago`
                          dueDateText = 'In 5-15 Days'
                        }

                        return (
                          <div key={s.id} style={{
                            border: `1px solid ${isOverdue ? '#fca5a5' : '#fed7aa'}`,
                            borderRadius: '12px', padding: '14px',
                            background: isOverdue ? '#fef2f2' : '#fffbeb',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e1b4b' }}>
                                  #{s.invoice_no}
                                </span>
                                <span style={{
                                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 700,
                                  background: isOverdue ? '#fee2e2' : '#fef3c7',
                                  color: isOverdue ? '#dc2626' : '#d97706'
                                }}>
                                  {statusBadge}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                Bill Date: {billDate.toLocaleDateString('en-IN')} · Promised Due Date: <strong style={{ color: '#9333ea' }}>{dueDateText}</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', fontFamily: 'DM Mono, monospace' }}>
                                  ₹{Number(s.net_amount).toFixed(2)}
                                </div>
                              </div>
                              <button
                                onClick={() => send15DayOverdueReminder(s)}
                                style={{
                                  background: '#16a34a', color: 'white', border: 'none',
                                  borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                                  fontWeight: 600, cursor: 'pointer', display: 'flex',
                                  alignItems: 'center', gap: '4px'
                                }}>
                                <MessageCircle size={14} /> Send Reminder
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
