import { useMemo, useState } from 'react'
import { X, FileJson, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { getSettings } from '../../utils/settings'
import { printHTML } from '../../utils/printHTML'
import {
  STATE_CODES, TRANS_MODES, buildEwayHTML, buildEwayJSON, downloadFile, ewayProblems,
  type EwayForm, type EwayParty,
} from '../../utils/ewayBill'

const C = { primary: '#1d4ed8', border: '#dbeafe', muted: '#64748b' }
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', background: 'white' }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, display: 'flex', flexDirection: 'column', gap: 4 }
const section: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '6px 0' }
const STATES = Object.keys(STATE_CODES)

/** E-way bill for a just-made wholesale invoice: fill the gaps, download JSON + PDF. */
export function EwayBillModal({ saleData, onClose }: { saleData: any; onClose: () => void }) {
  const s = getSettings()
  const p = saleData.party || {}
  const [addrLine1, ...addrRest] = String(s.shopAddress || '').split(/,|\n/).map(x => x.trim()).filter(Boolean)
  const disc = 1 - (Number(saleData.discountPct) || 0) / 100

  const [f, setF] = useState<EwayForm>(() => ({
    docNo: saleData.invoiceNo, docDate: new Date().toISOString().slice(0, 10),
    from: { gstin: (s.gstin || '').toUpperCase(), name: s.shopName || '', addr1: addrLine1 || '', addr2: addrRest.join(', '),
            place: s.city || '', pincode: s.pincode || '', state: s.state || 'Gujarat' },
    to: { gstin: (p.gstin || '').toUpperCase(), name: p.business_name || p.name || '', addr1: p.address || '', addr2: '',
          place: p.city || '', pincode: p.pincode || '', state: p.state || 'Gujarat' },
    igst: saleData.gstType === 'igst',
    // Each line's value after its own discount and its share of the bill discount — the invoice's taxable value.
    items: (saleData.cart || []).map((i: any) => ({
      name: i.product?.name || 'Item',
      desc: [i.product?.design_no && `D:${i.product.design_no}`, i.product?.size, i.product?.colour].filter(Boolean).join(' · '),
      hsn: String(i.product?.hsn_code || ''), qty: Number(i.qty) || 0,
      taxable: Number(i.qty) * Number(i.unit_price) * (1 - (Number(i.discount_pct) || 0) / 100) * disc,
      gstRate: Number(i.gst_rate) || 0,
    })),
    othValue: Number(saleData.freight) || 0,
    totInvValue: Number(saleData.netAmount) || 0,
    transMode: '1', distanceKm: 0, transporterName: '', transporterId: '', transDocNo: '', transDocDate: '', vehicleNo: '',
  }))
  const [hsnAll, setHsnAll] = useState('')

  const set = (patch: Partial<EwayForm>) => setF(x => ({ ...x, ...patch }))
  const setParty = (who: 'from' | 'to', patch: Partial<EwayParty>) => setF(x => ({ ...x, [who]: { ...x[who], ...patch } }))
  const problems = useMemo(() => ewayProblems(f), [f])
  const fileBase = `EWB-${f.docNo}`

  // The party's PIN code is kept for their next e-way bill.
  const rememberPin = () => {
    if (p.id && f.to.pincode && f.to.pincode !== p.pincode)
      void supabase.from('wholesale_customers').update({ pincode: f.to.pincode }).eq('id', p.id)
  }
  const ready = () => {
    if (problems.length) { toast.error(problems[0], { duration: 5000 }); return false }
    rememberPin(); return true
  }

  const downloadJSON = () => {
    if (!ready()) return
    downloadFile(`${fileBase}.json`, JSON.stringify(buildEwayJSON(f), null, 2), 'application/json')
    toast.success('JSON saved — upload it at ewaybillgst.gov.in → e-Waybill → Generate Bulk')
  }
  const downloadPDF = async () => {
    if (!ready()) return
    const html = buildEwayHTML(f)
    const render = window.electronAPI?.printing?.renderPDF
    if (!render) { printHTML(html); return }          // browser: print or save as PDF from the dialog
    const pdf = await render({ html, widthMm: 0 })
    if (!pdf?.ok || !pdf.base64) { toast.error(pdf?.error || 'Could not make the PDF'); return }
    downloadFile(`${fileBase}.pdf`, Uint8Array.from(atob(pdf.base64), c => c.charCodeAt(0)), 'application/pdf')
  }

  const partyFields = (who: 'from' | 'to', title: string) => {
    const x = f[who]
    return (
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={section}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={label}>GSTIN{who === 'to' && ' (blank = unregistered)'}
            <input style={input} value={x.gstin} onChange={e => setParty(who, { gstin: e.target.value.toUpperCase().trim() })} /></label>
          <label style={label}>Name<input style={input} value={x.name} onChange={e => setParty(who, { name: e.target.value })} /></label>
        </div>
        <label style={label}>Address<input style={input} value={x.addr1} onChange={e => setParty(who, { addr1: e.target.value })} /></label>
        <input style={input} placeholder="Address line 2" value={x.addr2} onChange={e => setParty(who, { addr2: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 1.2fr', gap: 8 }}>
          <label style={label}>Place<input style={input} value={x.place} onChange={e => setParty(who, { place: e.target.value })} /></label>
          <label style={label}>PIN<input style={input} inputMode="numeric" maxLength={6} value={x.pincode}
            onChange={e => setParty(who, { pincode: e.target.value.replace(/\D/g, '') })} /></label>
          <label style={label}>State
            <select style={input} value={x.state} onChange={e => setParty(who, { state: e.target.value })}>
              {STATES.map(st => <option key={st} value={st}>{st}</option>)}
            </select></label>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100000, display: 'flex',
                  alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 920, fontFamily: 'DM Sans, sans-serif',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>🚚 E-Way Bill · {f.docNo}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              Invoice value ₹{f.totInvValue.toLocaleString('en-IN')}
              {f.totInvValue <= 50000 && ' · under ₹50,000 — an e-way bill is usually not required'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {partyFields('from', 'From — your shop')}
            {partyFields('to', 'To — party')}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ ...label, flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={f.igst} onChange={e => set({ igst: e.target.checked })} /> Inter-state (IGST)
            </label>
            <label style={{ ...label, width: 170 }}>Invoice date<input type="date" style={input} value={f.docDate} onChange={e => set({ docDate: e.target.value })} /></label>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={section}>Items · HSN</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input style={{ ...input, width: 110 }} placeholder="HSN e.g. 6204" value={hsnAll} onChange={e => setHsnAll(e.target.value.replace(/\D/g, ''))} />
                <button onClick={() => set({ items: f.items.map(i => (i.hsn ? i : { ...i, hsn: hsnAll })) })}
                  style={{ padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#eff6ff', color: C.primary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Fill empty HSN</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 6 }}>
              <thead><tr style={{ color: C.muted, textAlign: 'left' }}>
                <th style={{ padding: 6 }}>#</th><th>Product</th><th style={{ width: 110 }}>HSN</th>
                <th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>GST</th></tr></thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 6, color: C.muted }}>{i + 1}</td>
                    <td><b>{it.name}</b> <span style={{ color: C.muted }}>{it.desc}</span></td>
                    <td><input style={{ ...input, padding: '5px 8px', borderColor: /^[0-9]{4,8}$/.test(it.hsn) ? '#e2e8f0' : '#fca5a5' }} value={it.hsn}
                      onChange={e => set({ items: f.items.map((x, j) => (j === i ? { ...x, hsn: e.target.value.replace(/\D/g, '') } : x)) })} /></td>
                    <td style={{ textAlign: 'right' }}>{it.qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>₹{it.taxable.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{it.gstRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
            <div style={section}>Transport (Part B)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              <label style={label}>Mode
                <select style={input} value={f.transMode} onChange={e => set({ transMode: e.target.value })}>
                  {Object.entries(TRANS_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
              <label style={label}>Distance (km, 0 = by PIN)
                <input style={input} type="number" min={0} value={f.distanceKm} onChange={e => set({ distanceKm: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <label style={label}>Vehicle no.
                <input style={input} placeholder="GJ05AB1234" value={f.vehicleNo} onChange={e => set({ vehicleNo: e.target.value.toUpperCase() })} /></label>
              <label style={label}>Transporter name
                <input style={input} value={f.transporterName} onChange={e => set({ transporterName: e.target.value })} /></label>
              <label style={label}>Transporter ID
                <input style={input} value={f.transporterId} onChange={e => set({ transporterId: e.target.value.toUpperCase().trim() })} /></label>
              <label style={label}>LR / doc no.
                <input style={input} value={f.transDocNo} onChange={e => set({ transDocNo: e.target.value })} /></label>
              <label style={label}>LR / doc date
                <input style={input} type="date" value={f.transDocDate} onChange={e => set({ transDocDate: e.target.value })} /></label>
            </div>
          </div>

          {problems.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
              {problems.map(m => <div key={m}>• {m}</div>)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Close</button>
          <button onClick={downloadPDF} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.primary}`, background: 'white',
            color: C.primary, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileDown size={16} /> Download PDF</button>
          <button data-enter-submit onClick={downloadJSON} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.primary,
            color: 'white', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileJson size={16} /> Download JSON</button>
        </div>
      </div>
    </div>
  )
}
