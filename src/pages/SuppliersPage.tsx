import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/shared/Layout'
import { EmptyState } from '../components/shared/EmptyState'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useSuppliers, type Supplier } from '../hooks/useSuppliers'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../utils/exportCSV'
import { Truck, Plus, Search, Edit3, Trash2, Phone, MessageCircle, FileText, X, Download } from 'lucide-react'
import { fmtDate } from '../utils/date'

const card: React.CSSProperties = {
  background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '20px', marginBottom: '16px'
}
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px',
  fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e',
  background: 'white', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '6px', display: 'block'
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
const GRID = '2fr 1.3fr 1.2fr 0.7fr 1fr 1fr 150px'
const INR = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const blankForm = { name: '', phone: '', gstin: '', email: '', address: '' }

export function SuppliersPage() {
  const navigate = useNavigate()
  const {
    filteredSuppliers, statsFor, totals, loading,
    search, setSearch, createSupplier, updateSupplier, deleteSupplier
  } = useSuppliers()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(blankForm)
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null)
  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null)

  const openAdd = () => { setEditing(null); setForm(blankForm); setShowForm(true) }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name || '', phone: s.phone || '', gstin: s.gstin || '',
      email: s.email || '', address: s.address || ''
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const ok = editing ? await updateSupplier(editing.id, form) : await createSupplier(form)
    if (ok) { setShowForm(false); setEditing(null); setForm(blankForm) }
  }

  const waLink = (phone: string) => {
    const clean = (phone || '').replace(/\D/g, '')
    const withCode = clean.startsWith('91') ? clean : '91' + clean
    return `https://wa.me/${withCode}`
  }

  const handleExport = () => {
    exportToCSV(
      filteredSuppliers.map(s => ({
        name: s.name, gstin: s.gstin || '', phone: s.phone || '', email: s.email || '',
        address: s.address || '',
        bills: statsFor(s.id).billCount,
        purchased: statsFor(s.id).totalPurchased.toFixed(2),
        outstanding: statsFor(s.id).outstanding.toFixed(2)
      })),
      'suppliers',
      [
        { key: 'name', label: 'Supplier' }, { key: 'gstin', label: 'GSTIN' },
        { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
        { key: 'address', label: 'Address' }, { key: 'bills', label: 'Bills' },
        { key: 'purchased', label: 'Total Purchased' }, { key: 'outstanding', label: 'Outstanding' }
      ]
    )
  }

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#fdf8ff', minHeight: '100%', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={20} color="#9333ea" />
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Suppliers</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleExport} style={btnOutline}><Download size={14} /> Export CSV</button>
            <button onClick={openAdd} style={btnPrimary}><Plus size={14} /> New Supplier</button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Total Suppliers', value: String(totals.supplierCount), color: '#9333ea' },
            { label: 'Total Purchased', value: INR(totals.totalPurchased), color: '#16a34a' },
            { label: 'Outstanding Payable', value: INR(totals.totalOutstanding), color: '#ef4444' }
          ].map(s => (
            <div key={s.label} style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
          <Search size={15} color="#9333ea" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, GSTIN or email..."
            style={{ ...inputStyle, border: 'none', padding: '4px 0' }}
          />
        </div>

        {/* Table */}
        <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 16px', borderBottom: '1px solid #f3e8ff', fontSize: '10px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div>Supplier</div><div>GSTIN</div><div>Phone</div><div>Bills</div>
            <div style={{ textAlign: 'right' }}>Purchased</div>
            <div style={{ textAlign: 'right' }}>Outstanding</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading suppliers...</div>
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState
              icon="🚚"
              title={search ? 'No suppliers match your search' : 'No suppliers yet'}
              subtitle={search ? 'Try a different name, phone or GSTIN.' : 'Add your first supplier to start recording purchases.'}
              actionLabel={search ? undefined : 'Add Supplier'}
              onAction={search ? undefined : openAdd}
            />
          ) : (
            filteredSuppliers.map(s => {
              const st = statsFor(s.id)
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid #fdf8ff', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1a0a2e' }}>{s.name}</div>
                    {s.address && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{s.address}</div>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{s.gstin || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{s.phone || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{st.billCount}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: '#16a34a', fontWeight: 600 }}>{INR(st.totalPurchased)}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: st.outstanding > 0 ? '#ef4444' : '#94a3b8' }}>
                    {st.outstanding > 0 ? INR(st.outstanding) : '—'}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                    {s.phone && (
                      <>
                        <a href={`tel:${s.phone}`} title="Call" style={{ ...iconBtn, display: 'inline-flex' }}><Phone size={13} /></a>
                        <a href={waLink(s.phone)} target="_blank" rel="noreferrer" title="WhatsApp"
                          style={{ ...iconBtn, display: 'inline-flex', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                          <MessageCircle size={13} />
                        </a>
                      </>
                    )}
                    <button onClick={() => setLedgerFor(s)} title="Ledger" style={iconBtn}><FileText size={13} /></button>
                    <button onClick={() => openEdit(s)} title="Edit" style={iconBtn}><Edit3 size={13} /></button>
                    <button onClick={() => setConfirmDelete(s)} title="Delete"
                      style={{ ...iconBtn, color: '#b91c1c', borderColor: '#fee2e2', background: '#fef2f2' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '16px', padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1a0a2e' }}>
                {editing ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Supplier Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Firm or person name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input style={inputStyle} value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} placeholder="24ABCDE1234F1Z5" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, State" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowForm(false)} style={{ ...btnOutline, color: '#64748b', borderColor: '#e2e8f0' }}>Cancel</button>
              <button onClick={handleSave} style={btnPrimary}>{editing ? 'Save Changes' : 'Add Supplier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger drawer */}
      {ledgerFor && <SupplierLedger supplier={ledgerFor} onClose={() => setLedgerFor(null)} onNewPurchase={() => navigate('/purchase-entry')} />}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete supplier?"
        message={`${confirmDelete?.name} will be removed. Suppliers with existing purchase bills cannot be deleted.`}
        confirmLabel="Delete"
        onConfirm={async () => { if (confirmDelete) await deleteSupplier(confirmDelete.id); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />
    </Layout>
  )
}

function SupplierLedger({ supplier, onClose, onNewPurchase }: { supplier: Supplier; onClose: () => void; onNewPurchase: () => void }) {
  const [bills, setBills] = useState<any[]>([])
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [b, r] = await Promise.all([
          supabase.from('purchase_bills').select('*').eq('supplier_id', supplier.id).order('created_at', { ascending: false }),
          supabase.from('purchase_returns').select('*').eq('supplier_id', supplier.id).order('created_at', { ascending: false })
        ])
        setBills(b.data || [])
        setReturns(r.data || [])
      } catch (e) {
        console.warn('Supplier ledger notice:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supplier.id])

  const purchased = bills.reduce((s, b) => s + (Number(b.net_amount) || 0), 0)
  const outstanding = bills.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + (Number(b.net_amount) || 0), 0)
  const returned = returns.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '640px', maxHeight: '82vh', overflowY: 'auto', background: 'white', borderRadius: '16px', padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1a0a2e' }}>{supplier.name}</h2>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              {supplier.phone || 'No phone'} {supplier.gstin ? ' · ' + supplier.gstin : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
          {[
            { label: 'Purchased', value: INR(purchased), color: '#16a34a' },
            { label: 'Outstanding', value: INR(outstanding), color: '#ef4444' },
            { label: 'Returned', value: INR(returned), color: '#9333ea' }
          ].map(s => (
            <div key={s.label} style={{ background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: s.color, fontFamily: 'DM Mono, monospace', marginTop: '4px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Purchase Bills</div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading...</div>
        ) : bills.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '1px dashed #f3e8ff', borderRadius: '10px' }}>
            No purchase bills recorded for this supplier yet.
          </div>
        ) : (
          bills.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #f3e8ff', borderRadius: '10px', marginBottom: '6px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>{b.purchase_no}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {fmtDate(new Date(b.created_at))}
                  {b.supplier_invoice_no ? ` · Inv ${b.supplier_invoice_no}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{INR(b.net_amount)}</div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                  background: b.payment_status === 'paid' ? '#f0fdf4' : '#fff7ed',
                  color: b.payment_status === 'paid' ? '#16a34a' : '#f59e0b'
                }}>
                  {b.payment_status === 'paid' ? 'PAID' : String(b.payment_status || 'pending').toUpperCase()}
                </span>
              </div>
            </div>
          ))
        )}

        <button onClick={onNewPurchase} style={{ ...btnPrimary, width: '100%', justifyContent: 'center', marginTop: '14px' }}>
          + New Purchase Entry
        </button>
      </div>
    </div>
  )
}
