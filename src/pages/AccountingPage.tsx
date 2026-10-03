import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/shared/Layout'
import { EmptyState } from '../components/shared/EmptyState'
import { useAccounts, payableOutstanding, receivableOutstanding, type PayableRow, type ReceivableRow } from '../hooks/useAccounts'
import { exportToCSV } from '../utils/exportCSV'
import { sendWhatsApp } from '../utils/whatsapp'
import { getSettings } from '../utils/settings'
import { Wallet, TrendingUp, TrendingDown, Ticket, Download, MessageCircle, Check, ArrowRight } from 'lucide-react'
import { fmtDate, fmtDayMonth } from '../utils/date'

const card: React.CSSProperties = {
  background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '20px', marginBottom: '16px'
}
const btnPrimary: React.CSSProperties = {
  background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 18px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  display: 'inline-flex', alignItems: 'center', gap: '6px'
}
const btnOutline: React.CSSProperties = {
  background: 'white', color: '#9333ea', border: '1px solid #c084fc', borderRadius: '10px',
  padding: '10px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '6px'
}
const iconBtn: React.CSSProperties = {
  border: '1px solid #e5e7eb', background: 'white', padding: '6px 8px',
  borderRadius: '8px', cursor: 'pointer', color: '#64748b', lineHeight: 0
}

const INR = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const waLink = (phone?: string | null) => {
  const clean = (phone || '').replace(/\D/g, '')
  return `https://wa.me/${clean.startsWith('91') ? clean : '91' + clean}`
}

type Tab = 'payables' | 'receivables' | 'daybook'

export function AccountingPage() {
  const navigate = useNavigate()
  const a = useAccounts()
  const [tab, setTab] = useState<Tab>('payables')
  const [payFor, setPayFor] = useState<
    | { kind: 'payable'; row: PayableRow; label: string; outstanding: number; paidSoFar: number }
    | { kind: 'receivable'; row: ReceivableRow; label: string; outstanding: number; paidSoFar: number }
    | null
  >(null)
  const [payAmount, setPayAmount] = useState<number | ''>('')
  const [payTender, setPayTender] = useState<'cash' | 'upi' | 'bank'>('cash')

  const openPayment = (p: NonNullable<typeof payFor>) => {
    setPayFor(p)
    setPayAmount(p.outstanding)
  }

  const AgeingBar = ({ ageing, total }: { ageing: Record<string, number>; total: number }) => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
      {(['0-30', '31-60', '60+'] as const).map(b => {
        const v = ageing[b] || 0
        const pct = total > 0 ? (v / total) * 100 : 0
        const colour = b === '0-30' ? '#16a34a' : b === '31-60' ? '#f59e0b' : '#ef4444'
        return (
          <div key={b} style={{ flex: 1, minWidth: '90px', background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '8px 10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{b} days</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: colour, fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>{INR(v)}</div>
            <div style={{ height: '3px', background: '#f3e8ff', borderRadius: '99px', marginTop: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: colour }} />
            </div>
          </div>
        )
      })}
    </div>
  )

  const exportCurrent = () => {
    if (tab === 'payables') {
      exportToCSV(
        a.payables.map(p => ({
          bill: p.purchase_no, supplier: p.suppliers?.name || '—',
          invoice: p.supplier_invoice_no || '', date: String(p.created_at).slice(0, 10),
          days: a.daysOld(p.created_at), billed: Number(p.net_amount || 0).toFixed(2),
          paid: Number(p.amount_paid || 0).toFixed(2), amount: payableOutstanding(p).toFixed(2)
        })),
        'payables',
        [{ key: 'bill', label: 'Bill' }, { key: 'supplier', label: 'Supplier' }, { key: 'invoice', label: 'Supplier Invoice' },
         { key: 'date', label: 'Date' }, { key: 'days', label: 'Days Old' }, { key: 'billed', label: 'Bill Total' },
         { key: 'paid', label: 'Paid So Far' }, { key: 'amount', label: 'Outstanding' }]
      )
    } else if (tab === 'receivables') {
      exportToCSV(
        a.receivables.map(r => ({
          invoice: r.invoice_no, customer: r.customers?.name || '—', phone: r.customers?.phone || '',
          date: String(r.created_at).slice(0, 10), due: r.credit_due_date || '',
          days: a.daysOld(r.created_at), udhar: Number(r.credit_amount || 0).toFixed(2),
          paid: Number(r.credit_paid || 0).toFixed(2), amount: receivableOutstanding(r).toFixed(2)
        })),
        'receivables',
        [{ key: 'invoice', label: 'Invoice' }, { key: 'customer', label: 'Customer' }, { key: 'phone', label: 'Phone' },
         { key: 'date', label: 'Date' }, { key: 'due', label: 'Due Date' }, { key: 'days', label: 'Days Old' },
         { key: 'udhar', label: 'Pending Total' }, { key: 'paid', label: 'Paid So Far' }, { key: 'amount', label: 'Outstanding' }]
      )
    } else {
      exportToCSV(
        a.dayBook.map(d => ({
          date: d.date, cashIn: d.cashIn.toFixed(2), upiIn: d.upiIn.toFixed(2), cardIn: d.cardIn.toFixed(2),
          creditGiven: d.creditGiven.toFixed(2), cashOut: d.cashOut.toFixed(2), digitalOut: d.digitalOut.toFixed(2),
          net: d.net.toFixed(2)
        })),
        'day_book',
        [{ key: 'date', label: 'Date' }, { key: 'cashIn', label: 'Cash In' }, { key: 'upiIn', label: 'UPI In' },
         { key: 'cardIn', label: 'Card In' }, { key: 'creditGiven', label: 'Credit Given' },
         { key: 'cashOut', label: 'Cash Out' }, { key: 'digitalOut', label: 'Digital Out' }, { key: 'net', label: 'Net' }]
      )
    }
  }

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#fdf8ff', minHeight: '100%', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={20} color="#9333ea" />
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Accounts</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportCurrent} style={btnOutline}><Download size={14} /> Export CSV</button>
            <button onClick={() => navigate('/reports')} style={btnPrimary}>P&amp;L / GST <ArrowRight size={14} /></button>
          </div>
        </div>

        {/* Position summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'You Owe (Payables)', value: INR(a.payableTotal), color: '#ef4444', sub: `${a.payables.length} unpaid bills` },
            { label: 'Owed To You (Pending)', value: INR(a.receivableTotal), color: '#f59e0b', sub: `${a.receivables.length} credit bills` },
            { label: 'Store Credit Liability', value: INR(a.creditNoteTotal), color: '#9333ea', sub: `${a.creditNotes.length} active notes` },
            { label: "Today's Net Cash Flow", value: INR(a.todayNet), color: a.todayNet >= 0 ? '#16a34a' : '#ef4444', sub: `In ${INR(a.todayCashIn)} · Out ${INR(a.todayCashOut)}` }
          ].map(s => (
            <div key={s.label} style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {([
            { key: 'payables', label: 'Payables', icon: TrendingDown },
            { key: 'receivables', label: 'Receivables', icon: TrendingUp },
            { key: 'daybook', label: 'Cash Book', icon: Wallet }
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '9px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: tab === key ? '#9333ea' : 'white',
                color: tab === key ? 'white' : '#64748b',
                boxShadow: tab === key ? '0 2px 8px rgba(147,51,234,0.2)' : 'none'
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {a.loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Loading accounts...</div>
        ) : tab === 'payables' ? (
          <div style={card}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e' }}>Supplier Payables</div>
            <AgeingBar ageing={a.payableAgeing} total={a.payableTotal} />

            {a.payables.length === 0 ? (
              <EmptyState icon="✅" title="Nothing owed to suppliers" subtitle="Every purchase bill is settled." />
            ) : (
              <div style={{ marginTop: '14px' }}>
                {a.payables.map(p => {
                  const days = a.daysOld(p.created_at)
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px', border: '1px solid #f3e8ff', borderRadius: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{p.suppliers?.name || 'Unknown supplier'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                          {p.purchase_no}{p.supplier_invoice_no ? ` · Inv ${p.supplier_invoice_no}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: days > 60 ? '#ef4444' : days > 30 ? '#f59e0b' : '#16a34a' }}>
                        {days} days old
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '14px', color: '#ef4444' }}>
                          {INR(payableOutstanding(p))}
                        </div>
                        {Number(p.amount_paid) > 0 && (
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>
                            {INR(p.amount_paid)} paid of {INR(p.net_amount)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {p.suppliers?.phone && (
                          <a href={waLink(p.suppliers.phone)} target="_blank" rel="noreferrer" title="WhatsApp supplier"
                            style={{ ...iconBtn, display: 'inline-flex', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                            <MessageCircle size={13} />
                          </a>
                        )}
                        <button
                          onClick={() => openPayment({
                            kind: 'payable', row: p, label: p.purchase_no,
                            outstanding: payableOutstanding(p), paidSoFar: Number(p.amount_paid || 0)
                          })}
                          style={{ ...btnPrimary, padding: '6px 12px', fontSize: '12px' }}>
                          <Check size={13} /> Record Payment
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : tab === 'receivables' ? (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e' }}>Customer Pending Payments</div>
              {a.overdueReceivables.length > 0 && (
                <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '99px' }}>
                  {a.overdueReceivables.length} past promised due date
                </span>
              )}
            </div>
            <AgeingBar ageing={a.receivableAgeing} total={a.receivableTotal} />

            {a.receivables.length === 0 ? (
              <EmptyState icon="✅" title="No pending payments" subtitle="Every credit sale has been settled." />
            ) : (
              <div style={{ marginTop: '14px' }}>
                {a.receivables.map(r => {
                  const days = a.daysOld(r.created_at)
                  const overdue = !!r.credit_due_date && r.credit_due_date < new Date().toISOString().slice(0, 10)
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px', border: `1px solid ${overdue ? '#fecaca' : '#f3e8ff'}`, background: overdue ? '#fef2f2' : 'white', borderRadius: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{r.customers?.name || 'Walk-in customer'}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                          {r.invoice_no}
                          {Number(r.credit_amount) < Number(r.net_amount) ? ` · part of ${INR(r.net_amount)}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: overdue ? '#ef4444' : '#64748b' }}>
                        {r.credit_due_date ? (overdue ? `Overdue · due ${r.credit_due_date}` : `Due ${r.credit_due_date}`) : `${days} days old`}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '14px', color: '#f59e0b' }}>
                          {INR(receivableOutstanding(r))}
                        </div>
                        {Number(r.credit_paid) > 0 && (
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>
                            {INR(r.credit_paid)} paid of {INR(r.credit_amount)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {r.customers?.phone && (
                          <button title="Send pending-payment reminder on WhatsApp"
                            onClick={() => sendWhatsApp(r.customers!.phone!,
                              `Dear ${r.customers?.name || 'Customer'},\n\nA friendly reminder: ${INR(receivableOutstanding(r))} is pending against bill ${r.invoice_no}` +
                              `${r.credit_due_date ? ` (due ${fmtDate(new Date(r.credit_due_date))})` : ''}.\n\nThank you — ${getSettings().shopName || 'Team'}`)}
                            style={{ ...iconBtn, display: 'inline-flex', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                            <MessageCircle size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => openPayment({
                            kind: 'receivable', row: r, label: r.invoice_no,
                            outstanding: receivableOutstanding(r), paidSoFar: Number(r.credit_paid || 0)
                          })}
                          style={{ ...btnPrimary, padding: '6px 12px', fontSize: '12px' }}>
                          <Check size={13} /> Record Payment
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {a.creditNoteTotal > 0 && (
              <div style={{ marginTop: '14px', background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#9333ea', marginBottom: '6px' }}>
                  <Ticket size={13} /> Store Credit Owed to Customers — {INR(a.creditNoteTotal)}
                </div>
                <div style={{ fontSize: '11px', color: '#701a75' }}>
                  This is money your customers can still spend at the counter, not cash you collect.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a0a2e', marginBottom: '4px' }}>Cash Book — last 60 days</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
              Money in is taken from the actual tender split on each bill, so a part-cash / part-UPI sale counts in both columns.
            </div>

            {a.dayBook.length === 0 ? (
              <EmptyState icon="📒" title="No cash movement recorded" subtitle="Sales and expenses from the last 60 days will appear here." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '660px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #f3e8ff', fontSize: '10px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase' }}>
                    <div>Date</div>
                    <div style={{ textAlign: 'right' }}>Cash In</div>
                    <div style={{ textAlign: 'right' }}>UPI In</div>
                    <div style={{ textAlign: 'right' }}>Card In</div>
                    <div style={{ textAlign: 'right' }}>Pending Given</div>
                    <div style={{ textAlign: 'right' }}>Expenses</div>
                    <div style={{ textAlign: 'right' }}>Net</div>
                  </div>
                  {a.dayBook.map(d => (
                    <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 12px', borderBottom: '1px solid #fdf8ff', fontSize: '12.5px', fontFamily: 'DM Mono, monospace' }}>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#1a0a2e' }}>
                        {fmtDayMonth(new Date(d.date))}
                      </div>
                      <div style={{ textAlign: 'right', color: d.cashIn > 0 ? '#16a34a' : '#cbd5e1' }}>{INR(d.cashIn)}</div>
                      <div style={{ textAlign: 'right', color: d.upiIn > 0 ? '#16a34a' : '#cbd5e1' }}>{INR(d.upiIn)}</div>
                      <div style={{ textAlign: 'right', color: d.cardIn > 0 ? '#16a34a' : '#cbd5e1' }}>{INR(d.cardIn)}</div>
                      <div style={{ textAlign: 'right', color: d.creditGiven > 0 ? '#f59e0b' : '#cbd5e1' }}>{INR(d.creditGiven)}</div>
                      <div style={{ textAlign: 'right', color: (d.cashOut + d.digitalOut) > 0 ? '#ef4444' : '#cbd5e1' }}>{INR(d.cashOut + d.digitalOut)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color: d.net >= 0 ? '#16a34a' : '#ef4444' }}>{INR(d.net)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment entry — supports part payment */}
      {payFor && (() => {
        const entered = Number(payAmount) || 0
        const capped = Math.min(entered, payFor.outstanding)
        const remainingAfter = Math.max(0, payFor.outstanding - capped)
        return (
          <div onClick={() => setPayFor(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '16px', padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700, color: '#1a0a2e' }}>
                {payFor.kind === 'payable' ? 'Record supplier payment' : 'Record customer payment'}
              </h2>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginBottom: '16px' }}>
                {payFor.label}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                <span>Outstanding</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#1a0a2e' }}>{INR(payFor.outstanding)}</span>
              </div>
              {payFor.paidSoFar > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a', marginBottom: '4px' }}>
                  <span>Already paid</span>
                  <span style={{ fontFamily: 'DM Mono, monospace' }}>{INR(payFor.paidSoFar)}</span>
                </div>
              )}

              <label style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px', display: 'block' }}>
                Amount received now
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number" min={0} autoFocus
                  value={payAmount === '' ? '' : payAmount}
                  onChange={e => setPayAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    flex: 1, minWidth: 0, border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 12px',
                    fontSize: '15px', fontFamily: 'DM Mono, monospace', outline: 'none', color: '#1a0a2e', background: 'white'
                  }}
                />
                <button onClick={() => setPayAmount(payFor.outstanding)} style={{ ...btnOutline, padding: '8px 12px', fontSize: '12px' }}>
                  Full
                </button>
              </div>

              {/* Tender — determines whether cash-in-hand or the bank balance moves */}
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px', display: 'block' }}>
                Paid by
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['cash', 'upi', 'bank'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setPayTender(t)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', textTransform: 'capitalize',
                      border: payTender === t ? 'none' : '1px solid #f3e8ff',
                      background: payTender === t ? '#9333ea' : 'white',
                      color: payTender === t ? 'white' : '#64748b'
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{
                marginTop: '10px', padding: '9px 11px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: remainingAfter > 0 ? '#fff7ed' : '#f0fdf4',
                color: remainingAfter > 0 ? '#b45309' : '#16a34a'
              }}>
                {remainingAfter > 0
                  ? `Part payment — ${INR(remainingAfter)} will still be outstanding`
                  : 'This clears the balance in full'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button onClick={() => setPayFor(null)} style={{ ...btnOutline, color: '#64748b', borderColor: '#e2e8f0' }}>Cancel</button>
                <button
                  onClick={async () => {
                    if (payFor.kind === 'payable') await a.settlePayable(payFor.row, capped, payTender)
                    else await a.settleReceivable(payFor.row, capped, payTender)
                    setPayFor(null)
                    setPayAmount('')
                    setPayTender('cash')
                  }}
                  style={btnPrimary}>
                  Record {INR(capped)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </Layout>
  )
}
