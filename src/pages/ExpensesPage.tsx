import { useState, useEffect } from 'react'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Plus, X, Receipt } from 'lucide-react'

// ─── Orange theme ─────────────────────────────────────────────────────────────
const O = {
  primary: '#f97316',
  light:   '#fff7ed',
  border:  '#fed7aa',
  hover:   '#fff7ed',
  text:    '#9a3412',
  muted:   '#64748b',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
  outline: 'none', color: '#1a0a2e', background: 'white', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px',
}

// ─── Categories ───────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  {
    category: 'Staff', icon: '👥', color: '#2563eb', bg: '#eff6ff',
    subcategories: ['Salary', 'Advance', 'Bonus', 'Commission', 'Overtime']
  },
  {
    category: 'Rent & Utilities', icon: '🏠', color: '#9333ea', bg: '#f5f3ff',
    subcategories: ['Shop Rent', 'Electricity Bill', 'Water Bill', 'Internet / WiFi', 'Phone Bill', 'Gas Bill']
  },
  {
    category: 'Transport', icon: '🚚', color: '#16a34a', bg: '#f0fdf4',
    subcategories: ['Delivery Charges', 'Auto / Rickshaw', 'Fuel', 'Vehicle Maintenance', 'Parking']
  },
  {
    category: 'Shop Maintenance', icon: '🔧', color: '#d97706', bg: '#fffbeb',
    subcategories: ['Repair & Maintenance', 'Cleaning', 'Security', 'Pest Control', 'Renovation']
  },
  {
    category: 'Marketing', icon: '📢', color: '#ec4899', bg: '#fdf2f8',
    subcategories: ['Printing / Banners', 'Social Media', 'Gifts / Samples', 'Events', 'Advertising']
  },
  {
    category: 'Office & Supplies', icon: '📦', color: '#0891b2', bg: '#ecfeff',
    subcategories: ['Stationery', 'Packaging Material', 'Carry Bags', 'Labels / Tags', 'Computer Supplies']
  },
  {
    category: 'Banking & Finance', icon: '🏦', color: '#7c3aed', bg: '#f5f3ff',
    subcategories: ['Bank Charges', 'Loan EMI', 'Interest Payment', 'Insurance Premium', 'GST Payment']
  },
  {
    category: 'Other', icon: '📝', color: '#64748b', bg: '#f8fafc',
    subcategories: ['Miscellaneous', 'Emergency', 'Custom']
  },
]

const CAT_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.category, c]))

const CHART_COLORS: Record<string, string> = {
  'Staff': '#2563eb',
  'Rent & Utilities': '#9333ea',
  'Transport': '#16a34a',
  'Shop Maintenance': '#d97706',
  'Marketing': '#ec4899',
  'Office & Supplies': '#0891b2',
  'Banking & Finance': '#7c3aed',
  'Other': '#94a3b8',
}

// ─── Expense counter ──────────────────────────────────────────────────────────
const getExpenseNo = () => {
  const stored = localStorage.getItem('expense_counter')
  const n = stored ? parseInt(stored, 10) + 1 : 1
  localStorage.setItem('expense_counter', String(n))
  return 'EXP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(n).padStart(4, '0')
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank' | 'upi' | 'cheque'>('cash')
  const [paidTo, setPaidTo] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [referenceNo, setReferenceNo] = useState('')
  const [saving, setSaving] = useState(false)

  const catObj = EXPENSE_CATEGORIES.find(c => c.category === category)

  const handleSave = async () => {
    if (!category) { toast.error('Select a category'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }

    setSaving(true)
    try {
      const expenseNo = getExpenseNo()
      const now = new Date(expenseDate)
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const { error } = await supabase.from('expenses').insert({
        expense_no: expenseNo,
        category,
        subcategory: subcategory || null,
        description: description || null,
        amount: amt,
        payment_mode: paymentMode,
        paid_to: paidTo || null,
        reference_no: referenceNo || null,
        expense_date: expenseDate,
        month,
      })

      if (error) throw error
      toast.success('Expense saved!')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '540px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a0a2e' }}>Add Expense</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Category grid */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Category *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c.category} onClick={() => { setCategory(c.category); setSubcategory('') }}
                  style={{
                    padding: '10px 8px', borderRadius: '10px', border: category === c.category ? `2px solid ${c.color}` : '1px solid #e2e8f0',
                    background: category === c.category ? c.bg : 'white',
                    cursor: 'pointer', textAlign: 'center', fontFamily: 'DM Sans',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: category === c.category ? 700 : 400, color: category === c.category ? c.color : '#64748b', lineHeight: 1.2 }}>
                    {c.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory */}
          {catObj && (
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Subcategory</label>
              <select value={subcategory} onChange={e => setSubcategory(e.target.value)} style={inputStyle}>
                <option value="">Select subcategory...</option>
                {catObj.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="e.g. March salary for Amit Shah"
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Amount *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', fontWeight: 600, color: O.primary }}>₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" min="0"
                style={{ ...inputStyle, paddingLeft: '28px', fontSize: '18px', fontWeight: 700, color: O.primary, fontFamily: 'DM Mono' }} />
            </div>
          </div>

          {/* Row: Payment mode + Paid to */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Payment Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {(['cash', 'bank', 'upi', 'cheque'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMode(m)}
                    style={{ padding: '7px', border: paymentMode === m ? `2px solid ${O.primary}` : '1px solid #e2e8f0', borderRadius: '8px', background: paymentMode === m ? O.light : 'white', color: paymentMode === m ? O.text : '#64748b', fontSize: '12px', fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: paymentMode === m ? 600 : 400, textTransform: 'capitalize' }}>
                    {m === 'bank' ? 'Bank' : m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Paid To</label>
              <input value={paidTo} onChange={e => setPaidTo(e.target.value)}
                placeholder="e.g. Amit Shah, BESCOM" style={inputStyle} />
            </div>
          </div>

          {/* Row: Date + Ref no */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reference No (optional)</label>
              <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                placeholder="Cheque no / UTR no" style={inputStyle} />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', padding: '12px', background: saving ? '#fdba74' : O.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans' }}>
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Salary Tracker Card ──────────────────────────────────────────────────────
function SalaryTracker({ onExpenseSaved }: { onExpenseSaved: () => void }) {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('users').select('id,name,role,monthly_salary,salary_paid_date').eq('is_active', true)
      .then(({ data }) => { setStaff(data || []); setLoading(false) })
  }, [])

  const now = new Date()
  const currentMonth = `${now.toLocaleString('en-IN', { month: 'long' })} ${now.getFullYear()}`

  const isPaidThisMonth = (paidDate: string | null) => {
    if (!paidDate) return false
    const d = new Date(paidDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  const paySalary = async (s: any) => {
    const salary = s.monthly_salary || 0
    if (salary <= 0) { toast.error('No salary amount set for ' + s.name); return }
    setPayingId(s.id)
    try {
      const expenseNo = getExpenseNo()
      const today = now.toISOString().slice(0, 10)
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const { error: expErr } = await supabase.from('expenses').insert({
        expense_no: expenseNo,
        category: 'Staff',
        subcategory: 'Salary',
        description: `${s.name} salary - ${currentMonth}`,
        amount: salary,
        payment_mode: 'cash',
        paid_to: s.name,
        expense_date: today,
        month,
      })
      if (expErr) throw expErr

      await supabase.from('users').update({ salary_paid_date: today }).eq('id', s.id)
      setStaff(prev => prev.map(x => x.id === s.id ? { ...x, salary_paid_date: today } : x))
      toast.success(`₹${salary.toLocaleString('en-IN')} paid to ${s.name}`)
      onExpenseSaved()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setPayingId(null)
    }
  }

  const staffWithSalary = staff.filter(s => s.monthly_salary > 0)
  if (!loading && staffWithSalary.length === 0) return null

  return (
    <div style={{ background: 'white', border: `1px solid ${O.border}`, borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a0a2e', marginBottom: '4px' }}>Salary Tracker</div>
      <div style={{ fontSize: '12px', color: O.muted, marginBottom: '16px' }}>{currentMonth}</div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: '13px' }}>Loading staff...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Name', 'Role', 'Monthly Salary', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffWithSalary.map(s => {
              const paid = isPaidThisMonth(s.salary_paid_date)
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '10px 8px', color: O.muted, textTransform: 'capitalize' }}>{s.role}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'DM Mono', fontWeight: 600, color: '#1a0a2e' }}>
                    ₹{(s.monthly_salary || 0).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                      background: paid ? '#f0fdf4' : '#fff7ed',
                      color: paid ? '#16a34a' : '#ea580c',
                    }}>
                      {paid ? '✅ Paid' : '⏳ Due'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {!paid && (
                      <button onClick={() => paySalary(s)} disabled={payingId === s.id}
                        style={{ background: O.primary, color: 'white', border: 'none', borderRadius: '7px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
                        {payingId === s.id ? 'Paying...' : 'Pay Salary'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', dateFrom)
        .lte('expense_date', dateTo)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (categoryFilter !== 'All') {
        q = q.eq('category', categoryFilter)
      }

      const { data } = await q
      setExpenses(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExpenses() }, [dateFrom, dateTo, categoryFilter])

  // ── Stats ──
  const now = new Date()
  const thisMonthTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  const todayTotal = expenses
    .filter(e => e.expense_date === now.toISOString().slice(0, 10))
    .reduce((s, e) => s + (e.amount || 0), 0)

  const catTotals: Record<string, number> = {}
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (e.amount || 0) })
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]

  // ── Chart data ──
  const chartData = EXPENSE_CATEGORIES.map(c => ({
    name: c.category.split(' ')[0], // short name
    fullName: c.category,
    amount: catTotals[c.category] || 0,
    color: c.color,
  })).filter(d => d.amount > 0)

  // ── Grouped by date ──
  const grouped: Record<string, any[]> = {}
  expenses.forEach(e => {
    const key = e.expense_date
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Error deleting'); return }
    toast.success('Deleted')
    fetchExpenses()
  }

  return (
    <Layout>
      <div style={{ padding: '24px', background: '#fff7ed', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: O.primary, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={18} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1a0a2e' }}>Expenses</h1>
              <div style={{ fontSize: '12px', color: O.muted }}>Track all business expenses</div>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: O.primary, color: 'white', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            <Plus size={15} /> Add Expense
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'This Period Total', value: `₹${thisMonthTotal.toLocaleString('en-IN')}`, color: O.primary },
            { label: "Today's Expenses", value: `₹${todayTotal.toLocaleString('en-IN')}`, color: '#2563eb' },
            { label: 'Top Category', value: topCategory ? `${CAT_MAP[topCategory[0]]?.icon || ''} ${topCategory[0]}` : '—', color: topCategory ? (CAT_MAP[topCategory[0]]?.color || '#94a3b8') : '#94a3b8', mono: false },
            { label: 'No. of Entries', value: String(expenses.length), color: '#9333ea' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: `1px solid ${O.border}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: O.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: c.color, fontFamily: (c as any).mono === false ? 'DM Sans' : 'DM Mono' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Salary tracker */}
        <SalaryTracker onExpenseSaved={fetchExpenses} />

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: O.muted }}>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ ...inputStyle, width: '140px' }} />
            <span style={{ fontSize: '12px', color: O.muted }}>To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ ...inputStyle, width: '140px' }} />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            style={{ ...inputStyle, width: '200px' }}>
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.category} value={c.category}>{c.icon} {c.category}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>
          {/* LEFT: Expenses list */}
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: 'white', borderRadius: '14px', border: `1px solid ${O.border}` }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>No expenses found</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Click + Add Expense to record one</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(grouped).map(([date, dayExpenses]) => {
                  const dayTotal = dayExpenses.reduce((s, e) => s + (e.amount || 0), 0)
                  return (
                    <div key={date}>
                      {/* Date header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>
                          {formatDateLabel(date)}
                          <span style={{ fontWeight: 400, color: O.muted, marginLeft: '6px', fontSize: '12px' }}>
                            · {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: O.primary, fontFamily: 'DM Mono' }}>
                          Total: ₹{dayTotal.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div style={{ background: 'white', border: `1px solid ${O.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tbody>
                            {dayExpenses.map((e: any) => {
                              const cat = CAT_MAP[e.category]
                              return (
                                <tr key={e.id} style={{ borderBottom: '1px solid #f8fafc' }}
                                  onMouseEnter={ev => (ev.currentTarget.style.background = '#fffbf5')}
                                  onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}>
                                  {/* Category */}
                                  <td style={{ padding: '12px', width: '48px' }}>
                                    <div style={{ width: '36px', height: '36px', background: cat?.bg || '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                      {cat?.icon || '📝'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 500, color: '#1a0a2e' }}>
                                      {e.subcategory || e.category}
                                    </div>
                                    <div style={{ fontSize: '11px', color: O.muted, marginTop: '2px' }}>
                                      {cat?.category}
                                      {e.description && <span> · {e.description}</span>}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px', color: O.muted, fontSize: '12px' }}>
                                    {e.paid_to || '—'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '99px', textTransform: 'capitalize' }}>
                                      {e.payment_mode === 'bank' ? 'Bank' : e.payment_mode}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px', fontFamily: 'DM Mono', fontWeight: 700, color: O.primary, fontSize: '14px', textAlign: 'right' }}>
                                    ₹{(e.amount || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '12px', width: '40px' }}>
                                    <button onClick={() => deleteExpense(e.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', opacity: 0.5 }}
                                      onMouseEnter={ev => (ev.currentTarget.style.opacity = '1')}
                                      onMouseLeave={ev => (ev.currentTarget.style.opacity = '0.5')}>
                                      <X size={13} />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Chart */}
          {chartData.length > 0 && (
            <div style={{ position: 'sticky', top: '24px' }}>
              <div style={{ background: 'white', border: `1px solid ${O.border}`, borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a0a2e', marginBottom: '16px' }}>
                  Expenses by Category
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                    <Tooltip
                      formatter={(v: any, _: any, props: any) => [`₹${Number(v).toLocaleString('en-IN')}`, props.payload.fullName]}
                      contentStyle={{ fontSize: '12px', fontFamily: 'DM Sans', borderRadius: '8px' }}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={CHART_COLORS[entry.fullName] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {chartData.map(d => (
                    <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: CHART_COLORS[d.fullName] || '#94a3b8' }} />
                        <span style={{ color: '#64748b' }}>{d.fullName}</span>
                      </div>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 600, color: '#1a0a2e' }}>
                        ₹{d.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddExpenseModal
          onClose={() => setShowAddModal(false)}
          onSaved={fetchExpenses}
        />
      )}
    </Layout>
  )
}
