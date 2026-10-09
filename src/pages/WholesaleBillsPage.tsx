import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Search, Loader2, X, Truck, MessageCircle, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { Layout } from '../components/shared/Layout'
import { useLiveRefresh } from '../hooks/useLiveRefresh'
import { supabase } from '../lib/supabase'
import { S } from '../components/bills/billEditStyles'
import { money } from '../utils/billEdits'
import { fmtDate } from '../utils/date'
import { sendWhatsApp } from '../utils/whatsapp'
import { getSettings } from '../utils/settings'
import { EwayBillModal } from '../components/wholesale/EwayBillModal'
import { EditWholesaleModal } from '../components/bills/EditWholesaleModal'
import {
  printWholesaleBill, sendWholesaleWhatsApp, saleDataFromRow, WHOLESALE_BILL_SELECT,
} from '../utils/printWholesaleBill'

const pending = (b: any) => (b.payment_status === 'paid' ? 0 : Number(b.net_amount) || 0)
const partyName = (p: any) => p?.business_name || p?.name || '—'

/** Print, WhatsApp, e-way bill and edit for one saved wholesale bill. */
function BillActions({ bill, onEway, onEdit }: { bill: any; onEway: (b: any) => void; onEdit: (id: string) => void }) {
  const data = () => saleDataFromRow(bill)
  return (
    <div style={S.row}>
      <button style={S.btnOutline} title="Print A4 invoice" onClick={() => printWholesaleBill(data())}><Printer size={14} /></button>
      <button style={S.btnOutline} title={bill.wholesale_customers?.phone ? 'Send on WhatsApp' : 'No phone number for this party'}
        disabled={!bill.wholesale_customers?.phone} onClick={() => sendWholesaleWhatsApp(data())}><MessageCircle size={14} /></button>
      <button style={S.btnOutline} title="E-way bill (JSON + PDF)" onClick={() => onEway(bill)}><Truck size={14} /></button>
      <button style={S.btnOutline} title="Edit bill — add, copy or change items" onClick={() => onEdit(bill.id)}><Pencil size={14} /></button>
    </div>
  )
}

/** A wholesale party at a glance: details, totals and every bill with its items. */
function PartyModal({ party, bills, onClose, onEway, onEdit }: { party: any; bills: any[]; onClose: () => void; onEway: (b: any) => void; onEdit: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const mine = bills.filter(b => b.wholesale_customer_id === party.id)
  const total = mine.reduce((s, b) => s + (Number(b.net_amount) || 0), 0)
  const due = mine.reduce((s, b) => s + pending(b), 0)
  const pieces = mine.reduce((s, b) => s + (b.wholesale_sale_items || []).reduce((n: number, i: any) => n + Number(i.qty || 0), 0), 0)

  const sendStatement = () => {
    const shop = getSettings().shopName || 'Retail ERP'
    const lines = mine.filter(b => pending(b) > 0).map(b => `• ${b.invoice_no} (${fmtDate(b.created_at)}) — ${money(pending(b))}`)
    sendWhatsApp(party.phone, `Dear ${partyName(party)},\n\nPending wholesale bills with ${shop}:\n${lines.join('\n')}\n\nTotal pending: ${money(due)}\n\nThank you — ${shop}`)
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>{partyName(party)}</div>
            <div style={S.sub}>
              {[party.business_name && party.name !== party.business_name ? party.name : '', party.phone, party.gstin && `GSTIN ${party.gstin}`,
                [party.address, party.city, party.state, party.pincode].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={S.body}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[['Total business', money(total)], ['Pending', money(due)], ['Bills', String(mine.length)], ['Pieces bought', String(pieces)],
              ['Last bill', mine[0] ? fmtDate(mine[0].created_at) : '—'], ['Credit limit', party.credit_limit ? money(Number(party.credit_limit)) : '—']]
              .map(([k, v]) => (
                <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{k}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: k === 'Pending' && due > 0 ? '#b45309' : '#0f172a' }}>{v}</div>
                </div>))}
          </div>
          {due > 0 && party.phone && (
            <div><button style={S.btnOutline} onClick={sendStatement}><MessageCircle size={14} /> Send pending statement on WhatsApp</button></div>
          )}

          <div style={S.section}>Bills</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th} /><th style={S.th}>Invoice</th><th style={S.th}>Date</th><th style={{ ...S.th, textAlign: 'right' }}>Pieces</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Amount</th><th style={S.th}>Payment</th><th style={S.th} />
            </tr></thead>
            <tbody>
              {mine.map(b => (
                <Fragment key={b.id}>
                  <tr>
                    <td style={S.td}>
                      <button style={{ ...S.iconBtn, padding: 2 }} onClick={() => setOpen(open === b.id ? null : b.id)} aria-label="Show items">
                        {open === b.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    </td>
                    <td style={S.td}><b>{b.invoice_no}</b></td>
                    <td style={S.td}>{fmtDate(b.created_at)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{(b.wholesale_sale_items || []).reduce((n: number, i: any) => n + Number(i.qty || 0), 0)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(Number(b.net_amount))}</td>
                    <td style={{ ...S.td, color: pending(b) > 0 ? '#b45309' : '#15803d' }}>{pending(b) > 0 ? `pending · ${b.payment_mode}` : `paid · ${b.payment_mode}`}</td>
                    <td style={S.td}><BillActions bill={b} onEway={onEway} onEdit={onEdit} /></td>
                  </tr>
                  {open === b.id && (
                    <tr><td style={S.td} /><td colSpan={6} style={{ ...S.td, background: '#f8fafc' }}>
                      {(b.wholesale_sale_items || []).map((i: any, k: number) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '2px 0' }}>
                          <span>{i.products?.name || 'Product'} {[i.products?.design_no && `D:${i.products.design_no}`, i.products?.size, i.products?.colour].filter(Boolean).join(' · ')}
                            {' '}× {i.qty} @ {money(Number(i.unit_price))}</span>
                          <span>{money(Number(i.line_total))}</span>
                        </div>))}
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {!mine.length && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>No bills yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Every wholesale bill and party, like Purchase Bills is for purchases. */
export function WholesaleBillsPage() {
  const [tab, setTab] = useState<'bills' | 'parties'>('bills')
  const [bills, setBills] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [party, setParty] = useState<any>(null)
  const [eway, setEway] = useState<any>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [b, p] = await Promise.all([
      supabase.from('wholesale_sales').select(WHOLESALE_BILL_SELECT).order('created_at', { ascending: false }),
      supabase.from('wholesale_customers').select('*').order('name'),
    ])
    if (b.error || p.error) toast.error('Could not load wholesale bills')
    setBills(b.data || []); setParties(p.data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(['wholesale_sales'], load)

  const q = search.trim().toLowerCase()
  const shownBills = useMemo(() => bills.filter(b => !q ||
    [b.invoice_no, partyName(b.wholesale_customers), b.wholesale_customers?.phone].some(v => String(v || '').toLowerCase().includes(q))), [bills, q])
  const shownParties = useMemo(() => parties.filter(p => !q ||
    [p.name, p.business_name, p.phone, p.gstin, p.city].some(v => String(v || '').toLowerCase().includes(q))), [parties, q])

  return (
    <Layout>
      <div style={{ padding: '20px 24px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a0a2e' }}>Wholesale Bills</div>
            <div style={S.muted}>Every wholesale bill and party — print, WhatsApp and e-way bill any time.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: '#dbeafe', padding: 4, borderRadius: 12 }}>
              {(['bills', 'parties'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ border: 0, padding: '7px 14px', borderRadius: 9, fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1d4ed8' : '#475569' }}>
                  {t === 'bills' ? `Bills (${bills.length})` : `Parties (${parties.length})`}</button>))}
            </div>
            <div style={{ ...S.row, minWidth: 260 }}>
              <Search size={15} color="#64748b" />
              <input style={{ ...S.input, flex: 1 }} placeholder={tab === 'bills' ? 'Invoice no, party or phone' : 'Party, phone, GSTIN or city'}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, overflowX: 'auto' }}>
          {loading ? <div style={S.loading}><Loader2 size={20} className="spinner" /> Loading…</div>
          : tab === 'bills' ? (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Invoice</th><th style={S.th}>Date</th><th style={S.th}>Party</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Pieces</th><th style={{ ...S.th, textAlign: 'right' }}>Amount</th>
                <th style={S.th}>Payment</th><th style={S.th} />
              </tr></thead>
              <tbody>
                {shownBills.map(b => (
                  <tr key={b.id}>
                    <td style={S.td}><b>{b.invoice_no}</b></td>
                    <td style={S.td}>{fmtDate(b.created_at)}</td>
                    <td style={S.td}>
                      <button style={{ background: 'none', border: 0, padding: 0, color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => b.wholesale_customers && setParty(b.wholesale_customers)}>{partyName(b.wholesale_customers)}</button>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{(b.wholesale_sale_items || []).reduce((n: number, i: any) => n + Number(i.qty || 0), 0)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(Number(b.net_amount))}</td>
                    <td style={{ ...S.td, color: pending(b) > 0 ? '#b45309' : '#15803d' }}>{pending(b) > 0 ? `pending · ${b.payment_mode}` : `paid · ${b.payment_mode}`}</td>
                    <td style={S.td}><BillActions bill={b} onEway={setEway} onEdit={setEditId} /></td>
                  </tr>))}
                {!shownBills.length && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>No wholesale bills found</td></tr>}
              </tbody>
            </table>
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Party</th><th style={S.th}>Phone</th><th style={S.th}>GSTIN</th><th style={S.th}>City</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Bills</th><th style={{ ...S.th, textAlign: 'right' }}>Business</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Pending</th>
              </tr></thead>
              <tbody>
                {shownParties.map(p => {
                  const mine = bills.filter(b => b.wholesale_customer_id === p.id)
                  const due = mine.reduce((s, b) => s + pending(b), 0)
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setParty(p)}>
                      <td style={S.td}><b style={{ color: '#1d4ed8' }}>{partyName(p)}</b></td>
                      <td style={S.td}>{p.phone || '—'}</td>
                      <td style={S.td}>{p.gstin || '—'}</td>
                      <td style={S.td}>{p.city || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{mine.length}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(mine.reduce((s, b) => s + (Number(b.net_amount) || 0), 0))}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: due > 0 ? '#b45309' : '#15803d' }}>{due > 0 ? money(due) : '—'}</td>
                    </tr>)
                })}
                {!shownParties.length && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>No parties found</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {party && <PartyModal party={party} bills={bills} onClose={() => setParty(null)} onEway={b => setEway(b)} onEdit={setEditId} />}
      {editId && <EditWholesaleModal billId={editId} onClose={() => setEditId(null)} onSaved={() => load()} />}
      {eway && <EwayBillModal saleData={saleDataFromRow(eway)} onClose={() => setEway(null)} />}
    </Layout>
  )
}
