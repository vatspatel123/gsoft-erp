import { useState, useEffect, useRef } from 'react'
import { Layout } from '../components/shared/Layout'
import { getSettings, saveSettings, DEFAULT_SETTINGS, pushShopSettings, pullShopSettings, type AppSettings } from '../utils/settings'
import { supabase } from '../lib/supabase'
import { printBill, buildBillHTML, buildBillMessage } from '../utils/printBill'
import { printHTML, listPrinters, canSelectPrinters, autoAssignPrinters, clearPrintQueues, pendingJobs } from '../utils/printHTML'
import { printBarcodeLabels } from '../utils/printLabels'
import { printPurchaseA4 } from '../utils/printA4Purchase'
import { getCachedSalesmen, saveSalesmenToCache } from '../utils/offlineCache'
import type { WhatsAppState } from '../types'
import { waStatus, waConnect, waLogout, sendWhatsApp, isRelayConfigured } from '../utils/whatsapp'
import toast from 'react-hot-toast'

// ─── helpers ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Others',
]

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function isValidGSTIN(g: string) { return GSTIN_RE.test(g.toUpperCase()) }

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const csv = [headers, ...rows].map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── shared sub-components ───────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #f3e8ff',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '16px',
      ...style
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1a0a2e', margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
      {helper && <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{helper}</p>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #f3e8ff',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  color: '#1a0a2e',
  background: 'white',
  boxSizing: 'border-box',
}

function Toggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #fdf8ff' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{label}</div>
        {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '44px', height: '24px', borderRadius: '99px', border: 'none', cursor: 'pointer',
          background: value ? '#9333ea' : '#e2e8f0',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0
        }}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%', background: 'white',
          position: 'absolute', top: '3px',
          left: value ? '23px' : '3px', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </button>
    </div>
  )
}

function SaveBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', padding: '13px', background: '#9333ea', color: 'white',
      border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif",
      opacity: loading ? 0.7 : 1, marginTop: '8px'
    }}>
      {loading ? 'Saving...' : 'Save Changes'}
    </button>
  )
}

// ─── TAB 1: Shop Info ────────────────────────────────────────────────────────

function ShopInfoTab() {
  const [form, setForm] = useState(() => {
    const s = getSettings()
    return {
      shopName: s.shopName, shopTagline: s.shopTagline, ownerName: s.ownerName,
      shopAddress: s.shopAddress, shopPhone: s.shopPhone, shopEmail: s.shopEmail,
      gstin: s.gstin, state: s.state, city: s.city, pincode: s.pincode,
    }
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const gstinValid = form.gstin ? isValidGSTIN(form.gstin) : null

  const save = () => {
    saveSettings(form)
    toast.success('Shop info saved!')
  }

  return (
    <Card>
      <SectionTitle sub="This info appears on all your bills and reports">Shop Information</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        <Field label="Shop Name *">
          <input style={inputStyle} value={form.shopName} onChange={e => set('shopName', e.target.value)} placeholder="Your Shop Name" />
        </Field>
        <Field label="Shop Tagline">
          <input style={inputStyle} value={form.shopTagline} onChange={e => set('shopTagline', e.target.value)} placeholder="e.g. Fashion for Everyone" />
        </Field>
        <Field label="Owner Name">
          <input style={inputStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Owner / Proprietor Name" />
        </Field>
        <Field label="Phone Number">
          <input style={inputStyle} type="tel" value={form.shopPhone} onChange={e => set('shopPhone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
        </Field>
        <Field label="Email Address">
          <input style={inputStyle} type="email" value={form.shopEmail} onChange={e => set('shopEmail', e.target.value)} placeholder="shop@example.com" />
        </Field>
        <Field label="GSTIN" helper="Required for GST invoices. 15-character format.">
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: '40px', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}
              value={form.gstin}
              onChange={e => set('gstin', e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
            {form.gstin && (
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>
                {gstinValid ? '✅' : '❌'}
              </span>
            )}
          </div>
        </Field>
      </div>
      <Field label="Shop Address">
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} value={form.shopAddress} onChange={e => set('shopAddress', e.target.value)} placeholder="Full address with city and pincode" rows={3} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '0 20px' }}>
        <Field label="State">
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.state} onChange={e => set('state', e.target.value)}>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City">
          <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
        </Field>
        <Field label="Pincode">
          <input style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} type="number" value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="380001" maxLength={6} />
        </Field>
      </div>
      <SaveBtn onClick={save} />
    </Card>
  )
}

// ─── TAB 2: Bill & Print ─────────────────────────────────────────────────────

// Stand-in sale for the live preview and the test print. Deliberately exercises
// the awkward cases: long product names with sizes, a discount, and a split payment.
const SAMPLE_SALE = {
  invoiceNo: 'B/1457',
  cart: [
    { product: { name: '2353', category: 'PANTS', barcode: '45265', size: '42' }, qty: 1, unit_price: 1400, line_total: 1400 },
    { product: { name: '4375', category: 'TOP', barcode: '45792', size: '3XL' }, qty: 1, unit_price: 950, line_total: 950 },
    { product: { name: '803291', category: 'TOP', barcode: '44562', size: '3XL-4XL' }, qty: 2, unit_price: 1050, line_total: 2100 },
  ],
  customer: { name: 'Rekha', phone: '8488004851' },
  subtotal: 4450, gstAmount: 0, totalDiscount: 200, netAmount: 4250,
  paymentMode: 'upi',
  tenders: { cash: 250, card: 0, upi: 4000 },
  creditRemainder: 0,
  salesmanName: 'aadil',
  date: new Date().toISOString(),
  note: '',
}

// Stand-in shipping label so the third printer can be tested before the
// online-order label document itself is built.
const SAMPLE_LABEL_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;width:100mm;padding:4mm;color:#000}
  .b{border:1.5px solid #000;padding:4mm}
  h1{font-size:13pt;margin-bottom:2mm}
  .r{font-size:9pt;line-height:1.5}
  .c{margin-top:3mm;padding-top:3mm;border-top:1px dashed #000;font-size:11pt;font-weight:700}
</style></head><body><div class="b">
  <h1>TEST SHIPPING LABEL</h1>
  <div class="r">Deliver to<br><b>Sample Customer</b><br>12 Example Road, Surat 395003<br>M. 98250 00000</div>
  <div class="c">Order TEST-0001 &nbsp;|&nbsp; 1 parcel</div>
</div></body></html>`

function BillPrintTab() {
  const [s, setS] = useState(() => getSettings())
  const set = (k: keyof AppSettings, v: any) => setS(prev => ({ ...prev, [k]: v }))

  const save = () => { saveSettings(s); toast.success('Print settings saved!') }

  const [printers, setPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([])
  const [syncing, setSyncing] = useState(false)

  const [detecting, setDetecting] = useState(false)
  const [queued, setQueued] = useState(0)

  // A backlog is invisible until it lands on paper — sixty copies of one bill, in
  // the incident that prompted this. Show it here while the shop is on this screen.
  useEffect(() => {
    if (!canSelectPrinters()) return
    let alive = true
    const tick = () => pendingJobs().then(n => { if (alive) setQueued(n) })
    tick()
    const id = setInterval(tick, 15000)   // each tick spawns a PowerShell process; don't be greedy
    return () => { alive = false; clearInterval(id) }
  }, [])

  const loadPrinters = async () => {
    const list = await listPrinters()
    setPrinters(list)
    if (canSelectPrinters() && list.length === 0) toast.error('No printers reported by Windows')
    return list
  }

  // Work out which printer is which and fill the boxes in. `force` re-decides
  // even for printers already chosen by hand.
  const detect = async (force: boolean) => {
    setDetecting(true)
    try {
      await loadPrinters()
      const { patch, found } = await autoAssignPrinters({ force })
      if (!found) { toast.error('Windows reported no printers. Switch them on and try again.'); return }
      if (!Object.keys(patch).length) { toast('Nothing to change', { icon: 'ℹ️' }); return }
      saveSettings(patch)
      setS(prev => ({ ...prev, ...patch }))
      toast.success(`${found} printer${found === 1 ? '' : 's'} set up`)
    } finally { setDetecting(false) }
  }

  // A fresh install should be ready to print without anyone opening this screen
  // and matching Windows device names by hand.
  useEffect(() => {
    if (!canSelectPrinters()) { loadPrinters(); return }
    if (getSettings().billPrinter) { loadPrinters(); return }
    detect(false)
  }, [])

  const printTest = () => printBill(SAMPLE_SALE)

  // Save first: the print routes by the saved setting, not by what is on screen.
  const testPrint = (key: 'billPrinter' | 'barcodePrinter' | 'onlineLabelPrinter' | 'a4Printer') => {
    saveSettings({ [key]: s[key] } as Partial<AppSettings>)
    if (key === 'billPrinter') { printBill(SAMPLE_SALE); return }
    if (key === 'a4Printer') {
      // The real document, so the test proves the layout as well as the routing.
      printPurchaseA4({
        kind: 'purchase',
        docNo: 'TEST-001',
        date: new Date(),
        supplierName: 'Sample Supplier',
        items: [{ name: 'Sample item · 3XL', hsn: '6204', qty: 1, rate: 1255, gstPct: 5 }],
      })
      return
    }
    if (key === 'barcodePrinter') {
      printBarcodeLabels([{
        name: '803291', design_no: '803291', colour: '', size: '3XL',
        barcode: '45918', mrp: 1500, sku: '45918',
      }], 1, '50x25')
      return
    }
    printHTML(SAMPLE_LABEL_HTML, { target: 'online', widthMm: 100, settleMs: 150 })
  }

  return (
    <>
      <Card style={{ border: '1px solid #ddd6fe' }}>
        <SectionTitle sub="Shop name, logo, conditions and footer follow the login onto every computer">
          Bill Settings Sync
        </SectionTitle>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={async () => {
              setSyncing(true)
              const ok = await pushShopSettings()
              setSyncing(false)
              ok ? toast.success('Published — other computers get this on next sign-in')
                 : toast.error('Could not publish. Check the internet connection.')
            }}
            disabled={syncing}
            style={{ padding: '10px 16px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1, fontFamily: "'DM Sans', sans-serif" }}
          >
            {syncing ? 'Publishing…' : 'Publish to all computers'}
          </button>
          <button
            onClick={async () => {
              setSyncing(true)
              const ok = await pullShopSettings()
              setSyncing(false)
              if (ok) { toast.success('Loaded from the shop'); setTimeout(() => window.location.reload(), 800) }
              else toast('Nothing published yet — press Publish on the computer that is set up', { icon: 'ℹ️' })
            }}
            disabled={syncing}
            style={{ padding: '10px 16px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Load from the shop
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', marginBottom: 0, lineHeight: 1.6 }}>
          Printer choices are <b>not</b> published — each computer keeps its own, because the
          printers attached to one machine do not exist on another.
        </p>
      </Card>

      <Card>
        <SectionTitle sub="Customize what appears on your bills">Bill Customization</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Bill Header">
            <input style={inputStyle} value={s.billHeader} onChange={e => set('billHeader', e.target.value)} placeholder="Tax Invoice" />
          </Field>
          <Field label="Bill Footer">
            <input style={inputStyle} value={s.billFooter} onChange={e => set('billFooter', e.target.value)} placeholder="Thank you for shopping!" />
          </Field>
        </div>
        <Field label="Bill Conditions" helper="One per line. Printed under the total with a * in front.">
          <textarea
            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.5 }}
            value={s.billTerms}
            onChange={e => set('billTerms', e.target.value)}
            placeholder={'EXCHANGE WITHIN 3 DAYS.\nNO REFUND.'}
          />
        </Field>

        <Field label="Shop Logo" helper="Printed above the shop name. PNG or JPG, under 200 KB.">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {s.shopLogo && (
              <img src={s.shopLogo} alt="" style={{ height: '44px', maxWidth: '120px', objectFit: 'contain', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '4px', background: 'white' }} />
            )}
            <label style={{ padding: '9px 16px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
              {s.shopLogo ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.target.value = ''            // let the same file be picked again
                  if (!file) return
                  // Settings live in localStorage, which is small and shared with
                  // the offline cache — keep the logo well under its budget.
                  if (file.size > 200 * 1024) return toast.error('Logo must be under 200 KB')
                  const reader = new FileReader()
                  reader.onload = () => set('shopLogo', String(reader.result))
                  reader.onerror = () => toast.error('Could not read that image')
                  reader.readAsDataURL(file)
                }}
              />
            </label>
            {s.shopLogo && (
              <button
                onClick={() => set('shopLogo', '')}
                style={{ padding: '9px 14px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
              >
                Remove
              </button>
            )}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Show on Bill</div>
            <Toggle value={s.showGSTIN} onChange={v => set('showGSTIN', v)} label="GSTIN" sub="Show GST number on bill" />
            <Toggle value={s.showCustomer} onChange={v => set('showCustomer', v)} label="Customer Name & Phone" />
            <Toggle value={s.showSalesman} onChange={v => set('showSalesman', v)} label="Salesman Name" />
            <Toggle value={s.showPaymentBreakdown} onChange={v => set('showPaymentBreakdown', v)} label="Payment Details" sub="Cash / UPI / Card / Udhar split" />
            <Toggle value={s.showBarcode} onChange={v => set('showBarcode', v)} label="Barcode under each item" />
          </div>

          {/* The real bill template, rendered live with the edits above. Not a
              mock-up — a hand-drawn preview drifts away from the printed bill. */}
          <div style={{ width: '250px', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Live Preview
            </div>
            <iframe
              title="Bill preview"
              srcDoc={buildBillHTML(SAMPLE_SALE, s)}
              style={{
                width: '250px', height: '430px', border: '1px solid #f3e8ff',
                borderRadius: '8px', background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
              Exactly what prints and what the customer gets as a PDF on WhatsApp.
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="The text sent with the bill PDF on WhatsApp">WhatsApp Message</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Google Review Link" helper="Leave blank to leave this out of the message.">
            <input style={inputStyle} value={s.googleReviewUrl} onChange={e => set('googleReviewUrl', e.target.value)} placeholder="https://g.page/r/.../review" />
          </Field>
          <Field label="Instagram Link" helper="Leave blank to leave this out of the message.">
            <input style={inputStyle} value={s.instagramUrl} onChange={e => set('instagramUrl', e.target.value)} placeholder="https://www.instagram.com/yourshop" />
          </Field>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Preview</div>
        <div style={{
          background: '#dcf8c6', border: '1px solid #cfeab4', borderRadius: '12px',
          padding: '12px 14px', fontSize: '13px', color: '#1a0a2e', lineHeight: 1.5,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'DM Sans', sans-serif",
        }}>
          {buildBillMessage(SAMPLE_SALE, s)}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
          The bill PDF is attached to this message.
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Select paper size for your printer">Paper Size</SectionTitle>
        {(['58mm', '80mm', 'A4'] as const).map(size => (
          <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid #fdf8ff' }}>
            <input type="radio" checked={s.paperSize === size} onChange={() => set('paperSize', size)} style={{ accentColor: '#9333ea' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>
                {size === '58mm' ? '58mm — Small thermal printer' : size === '80mm' ? '80mm — Standard thermal printer (most common)' : 'A4 — Full page invoice'}
              </div>
            </div>
            {size === '80mm' && <span style={{ marginLeft: 'auto', fontSize: '10px', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '99px' }}>Default</span>}
          </label>
        ))}
      </Card>

      <Card>
        <SectionTitle>Auto Actions</SectionTitle>
        <Toggle value={s.autoPrint} onChange={v => set('autoPrint', v)} label="Auto Print after each sale" sub="Print dialog opens automatically after Complete Sale" />
        <Toggle value={s.autoWhatsApp} onChange={v => set('autoWhatsApp', v)} label="Auto WhatsApp after sale" sub="Opens WhatsApp automatically (customer needs phone number)" />
        <SaveBtn onClick={save} />
      </Card>

      <Card>
        <SectionTitle sub="Set on THIS computer only — every shop PC picks its own printers">Your Printers</SectionTitle>
        {!canSelectPrinters() ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
            Choosing a printer per document needs the <b>desktop app</b>. In a browser the
            print dialog opens and you pick the printer yourself each time.
          </div>
        ) : (
          <>
            {printers.length === 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#b91c1c', marginBottom: '14px' }}>
                Windows reported no printers. Connect and switch them on, then press Refresh.
              </div>
            )}

            {queued > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#b91c1c', lineHeight: 1.6, marginBottom: '10px' }}>
                  <b>{queued} print job{queued === 1 ? '' : 's'} waiting.</b> Windows holds jobs for a
                  printer that is switched off or jammed, then prints all of them at once when it
                  comes back. Clear them unless you are expecting these.
                </div>
                <button
                  onClick={async () => {
                    const r = await clearPrintQueues()
                    if (r.reason) toast.error(r.reason)
                    else toast.success(`Cleared ${r.removed} waiting job${r.removed === 1 ? '' : 's'}`)
                    setQueued(await pendingJobs())
                  }}
                  style={{ padding: '9px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Clear {queued} waiting job{queued === 1 ? '' : 's'}
                </button>
              </div>
            )}

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.6, marginBottom: '10px' }}>
                Plug the printers in, switch them on, then press this once. The app
                recognises receipt printers (Rugtek, POS-80, Epson TM) and label
                printers (TSC, TVS, Zebra) by name and fills in the boxes below.
              </div>
              <button
                onClick={() => detect(true)}
                disabled={detecting}
                style={{ padding: '10px 18px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: detecting ? 'not-allowed' : 'pointer', opacity: detecting ? 0.6 : 1, fontFamily: "'DM Sans', sans-serif" }}
              >
                {detecting ? 'Looking…' : '🔍 Detect my printers'}
              </button>
            </div>
            {([
              ['billPrinter', 'Bill / Receipt Printer', 'Sales bills, exchange slips, credit notes and purchase bills.'],
              ['barcodePrinter', 'Barcode Label Printer', 'Product barcode and price stickers.'],
              ['onlineLabelPrinter', 'Online Order Label Printer', 'Shipping and address stickers for web orders.'],
              ['a4Printer', 'A4 Printer', 'Purchase bills, purchase returns and wholesale invoices. Leave unset to pick from the dialog.'],
            ] as const).map(([key, label, helper]) => (
              <Field key={key} label={label} helper={helper}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    style={{ ...inputStyle, flex: 1 }}
                    value={s[key]}
                    onChange={e => set(key, e.target.value)}
                  >
                    <option value="">Ask me each time (show the print dialog)</option>
                    {printers.map(pr => (
                      <option key={pr.name} value={pr.name}>
                        {pr.displayName}{pr.isDefault ? '  (Windows default)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => testPrint(key)}
                    style={{ padding: '10px 14px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Test
                  </button>
                </div>
              </Field>
            ))}
            <Toggle
              value={s.rawThermal === true}
              onChange={v => { set('rawThermal', v); saveSettings({ rawThermal: v }) }}
              label="Fast text receipts"
              sub="OFF (recommended) prints the designed bill — logo, shop name, proper fonts and the ₹ sign. The app draws it as dots and sends them straight to the printer, so the printer driver never gets a chance to print blank. ON prints plain fixed-width text instead, which is slightly faster."
            />

            {s.rawThermal !== true && (
              <Field
                label="Printable width (mm)"
                helper="NOT the paper width. An 80mm thermal printer only marks about 72mm, and a 58mm one about 48mm — set this too wide and the Amount column falls off the right edge. 0 works it out from the paper size."
              >
                <input
                  type="number" step="1" style={{ ...inputStyle, maxWidth: '160px' }}
                  value={s.printWidthMm ?? 0}
                  onChange={e => set('printWidthMm', Number(e.target.value))}
                />
              </Field>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={loadPrinters}
                style={{ padding: '9px 16px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                ↻ Refresh printer list
              </button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {printers.length} printer{printers.length === 1 ? '' : 's'} found
              </span>
            </div>
            <SaveBtn onClick={save} />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Measured off your actual roll — every roll differs, so nothing here is guessed">
          Barcode Label Stock
        </SectionTitle>

        <Toggle
          value={s.rawLabels !== false}
          onChange={v => { set('rawLabels', v); saveSettings({ rawLabels: v }) }}
          label="Direct label printing (recommended)"
          sub="The app draws each label as dots (fonts and ₹ exactly as designed) and the printer draws the barcode itself, so it scans cleanly. Nothing passes through the printer driver, which is what stops labels coming out sideways or drifting onto the gap."
        />

        {s.rawLabels !== false && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '14px' }}>
              {([
                ['labelWidthMm', 'Label width (mm)', 'One label, not the whole roll'],
                ['labelHeightMm', 'Label height (mm)', ''],
                ['labelColumns', 'Labels across', '2 for side-by-side stock'],
                ['labelColumnGapMm', 'Gap between columns (mm)', ''],
                ['labelRowGapMm', 'Gap between rows (mm)', 'What the printer senses'],
                ['labelOffsetXmm', 'Shift right (mm)', 'Minus to shift left'],
                ['labelOffsetYmm', 'Shift down (mm)', 'Minus to shift up'],
                ['labelDarkness', 'Darkness (0-15)', 'Raise if bars look faint'],
                ['labelSpeed', 'Speed (1-6)', 'Lower prints darker'],
              ] as const).map(([key, label, helper]) => (
                <Field key={key} label={label} helper={helper}>
                  <input
                    type="number" step="0.5" style={inputStyle}
                    value={(s as any)[key]}
                    onChange={e => set(key as keyof AppSettings, Number(e.target.value))}
                  />
                </Field>
              ))}
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.6, marginTop: '4px' }}>
              <b>Print one, then look at it.</b> Adjust the shift values until the barcode
              sits where you want it, and only then print a batch. One label at a time
              costs nothing to get wrong.
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                onClick={() => {
                  saveSettings(s)
                  printBarcodeLabels([{
                    name: 'KURTI SET', design_no: '10128', colour: 'Maroon', size: '3XL',
                    barcode: '45918', mrp: 1450, sku: '45918',
                  }], 1, '38x38')
                }}
                style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Print 1 test label
              </button>
              <SaveBtn onClick={save} />
            </div>
          </>
        )}
      </Card>

      <Card style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
        <div style={{ fontWeight: 600, color: '#1a0a2e', marginBottom: '12px' }}>🖨️ How to connect your printer</div>
        <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.7 }}>
          <div><strong>1. USB Printer</strong> — plug in USB cable. Windows detects automatically.</div>
          <div><strong>2. Bluetooth Printer</strong> — Windows Settings → Bluetooth → pair first.</div>
          <div><strong>3. Network Printer</strong> — Windows Settings → Printers & Scanners → Add printer.</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
          <button
            onClick={() => { if (window.electronAPI) { /* electron shell open */ } else { window.open('ms-settings:printers') } }}
            style={{ padding: '9px 16px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Open Printer Settings
          </button>
          <button
            onClick={printTest}
            style={{ padding: '9px 16px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            🖨️ Print Test Bill
          </button>
        </div>
      </Card>
    </>
  )
}

// ─── TAB 3: Staff & PIN ──────────────────────────────────────────────────────

function StaffPINTab() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [changingPin, setChangingPin] = useState<string | null>(null)
  const [showPin, setShowPin] = useState<Record<string, boolean>>({})
  const [newPins, setNewPins] = useState<Record<string, { pin: string; confirm: string }>>({})
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'staff', pin: '', confirmPin: '' })
  const [editingName, setEditingName] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const load = async () => {
    setLoading(true)
    let fetched = []
    if (navigator.onLine) {
      const { data } = await supabase.from('users').select('*').order('name')
      fetched = data || []
      saveSalesmenToCache(fetched)
    } else {
      fetched = getCachedSalesmen() || []
    }
    setStaff(fetched)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const savePin = async (id: string) => {
    const p = newPins[id]
    if (!p?.pin || p.pin.length !== 4) { toast.error('PIN must be 4 digits'); return }
    if (p.pin !== p.confirm) { toast.error('PINs do not match'); return }
    const { error } = await supabase.from('users').update({ pin: p.pin }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('PIN updated!')
    setChangingPin(null)
    setNewPins(prev => { const n = { ...prev }; delete n[id]; return n })
    load()
  }

  const toggleActive = async (id: string, current: boolean) => {
    if (navigator.onLine) await supabase.from('users').update({ is_active: !current }).eq('id', id)
    const updated = staff.map(s => s.id === id ? { ...s, is_active: !current } : s)
    setStaff(updated)
    saveSalesmenToCache(updated)
  }

  const saveName = async (id: string) => {
    if (!newName.trim()) return
    if (navigator.onLine) await supabase.from('users').update({ name: newName.trim() }).eq('id', id)
    toast.success('Name updated')
    setEditingName(null)
    const updated = staff.map(s => s.id === id ? { ...s, name: newName.trim() } : s)
    setStaff(updated)
    saveSalesmenToCache(updated)
  }

  const deleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return
    if (navigator.onLine) await supabase.from('users').delete().eq('id', id)
    toast.success('Staff removed')
    const updated = staff.filter(s => s.id !== id)
    setStaff(updated)
    saveSalesmenToCache(updated)
  }

  const addStaff = async () => {
    if (!addForm.name.trim()) { toast.error('Name required'); return }
    if (addForm.pin.length !== 4) { toast.error('PIN must be 4 digits'); return }
    if (addForm.pin !== addForm.confirmPin) { toast.error('PINs do not match'); return }
    const newId = crypto.randomUUID()
    const payload = {
      id: newId, name: addForm.name, email: addForm.email || null,
      role: addForm.role, pin: addForm.pin, is_active: true
    }
    if (navigator.onLine) {
      const { error } = await supabase.from('users').insert(payload)
      if (error) { toast.error(error.message); return }
    }
    toast.success('Staff added!')
    setAddForm({ name: '', email: '', role: 'staff', pin: '', confirmPin: '' })
    setShowAddForm(false)
    const updated = [...staff, payload].sort((a, b) => a.name.localeCompare(b.name))
    setStaff(updated)
    saveSalesmenToCache(updated)
  }

  const ROLE_COLORS: Record<string, string> = { owner: '#9333ea', manager: '#2563eb', cashier: '#16a34a', staff: '#64748b' }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <SectionTitle sub="Manage staff accounts and PINs">Staff & PIN Management</SectionTitle>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '9px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
          + Add Staff
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, color: '#9333ea', marginBottom: '12px', fontSize: '13px' }}>New Staff Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input style={inputStyle} placeholder="Full Name *" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            <input style={inputStyle} placeholder="Email (optional)" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="staff">Staff</option>
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} placeholder="4-digit PIN" maxLength={4} type="password" value={addForm.pin} onChange={e => setAddForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} />
              <input style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} placeholder="Confirm PIN" maxLength={4} type="password" value={addForm.confirmPin} onChange={e => setAddForm(f => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={addStaff} style={{ padding: '9px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Save Staff</button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: '9px 18px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading staff...</div>
      ) : staff.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No staff found. Add your first staff member.</div>
      ) : (
        staff.map(member => (
          <div key={member.id} style={{ border: '1px solid #f3e8ff', borderRadius: '12px', padding: '16px', marginBottom: '10px', background: '#fdf8ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: ROLE_COLORS[member.role] || '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                {member.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName === member.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input style={{ ...inputStyle, padding: '6px 10px', fontSize: '13px' }} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                    <button onClick={() => saveName(member.id)} style={{ padding: '6px 12px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingName(null)} style={{ padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#64748b' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ fontWeight: 600, color: '#1a0a2e', fontSize: '14px' }}>{member.name}</div>
                )}
                {member.email && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{member.email}</div>}
                <span style={{ fontSize: '10px', fontWeight: 700, color: ROLE_COLORS[member.role] || '#64748b', background: '#f5f3ff', padding: '2px 8px', borderRadius: '99px', display: 'inline-block', marginTop: '2px', textTransform: 'uppercase' }}>{member.role}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => { setEditingName(member.id); setNewName(member.name) }} style={{ padding: '6px 10px', background: 'white', border: '1px solid #f3e8ff', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#9333ea' }}>✏️</button>
                <button onClick={() => toggleActive(member.id, member.is_active)} style={{ padding: '6px 10px', background: member.is_active ? '#f0fdf4' : '#fef2f2', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: member.is_active ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => deleteStaff(member.id, member.name)} style={{ padding: '6px 10px', background: '#fef2f2', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#ef4444' }}>🗑️</button>
              </div>
            </div>

            {/* PIN section */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3e8ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>PIN:</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', letterSpacing: '4px' }}>
                  {showPin[member.id] ? (member.pin || '—') : '••••'}
                </span>
                <button onClick={() => setShowPin(p => ({ ...p, [member.id]: !p[member.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#94a3b8' }}>
                  {showPin[member.id] ? '🙈' : '👁️'}
                </button>
                <button
                  onClick={() => setChangingPin(changingPin === member.id ? null : member.id)}
                  style={{ padding: '4px 12px', background: '#f5f3ff', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Change PIN
                </button>
              </div>
              {changingPin === member.id && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <input
                    style={{ ...inputStyle, width: '120px', fontFamily: "'DM Mono', monospace", padding: '8px 12px' }}
                    type="password" placeholder="New PIN" maxLength={4}
                    value={newPins[member.id]?.pin || ''}
                    onChange={e => setNewPins(p => ({ ...p, [member.id]: { ...p[member.id], pin: e.target.value.replace(/\D/g, '') } }))}
                  />
                  <input
                    style={{ ...inputStyle, width: '140px', fontFamily: "'DM Mono', monospace", padding: '8px 12px' }}
                    type="password" placeholder="Confirm PIN" maxLength={4}
                    value={newPins[member.id]?.confirm || ''}
                    onChange={e => setNewPins(p => ({ ...p, [member.id]: { ...p[member.id], confirm: e.target.value.replace(/\D/g, '') } }))}
                  />
                  <button onClick={() => savePin(member.id)} style={{ padding: '8px 16px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setChangingPin(null)} style={{ padding: '8px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

// ─── TAB 4: Notifications ────────────────────────────────────────────────────

function NotificationsTab() {
  const [s, setS] = useState(() => getSettings())
  const set = (k: keyof AppSettings, v: any) => setS(prev => ({ ...prev, [k]: v }))
  const save = () => { saveSettings(s); toast.success('Notification settings saved!') }

  return (
    <Card>
      <SectionTitle sub="Control which alerts and reminders are shown">Notification Settings</SectionTitle>
      <Toggle value={s.lowStockAlert} onChange={v => set('lowStockAlert', v)} label="Low Stock Alert" sub="Alert when product stock falls below threshold" />
      {s.lowStockAlert && (
        <div style={{ marginLeft: '20px', marginBottom: '12px', marginTop: '4px' }}>
          <Field label="Alert threshold (units)">
            <input style={{ ...inputStyle, width: '140px' }} type="number" min={1} value={s.lowStockThreshold} onChange={e => set('lowStockThreshold', parseInt(e.target.value) || 10)} />
          </Field>
        </div>
      )}
      <Toggle value={s.birthdayReminders} onChange={v => set('birthdayReminders', v)} label="Birthday Reminders" sub="Show birthday alerts for customers on their birthday" />
      <Toggle value={s.creditReminder} onChange={v => set('creditReminder', v)} label="Credit Payment Reminder" sub="Alert for outstanding credit sales" />
      {s.creditReminder && (
        <div style={{ marginLeft: '20px', marginBottom: '12px', marginTop: '4px' }}>
          <Field label="Remind after (days)">
            <input style={{ ...inputStyle, width: '140px' }} type="number" min={1} value={s.creditReminderDays} onChange={e => set('creditReminderDays', parseInt(e.target.value) || 7)} />
          </Field>
        </div>
      )}
      <Toggle value={s.dailyTargetEnabled} onChange={v => set('dailyTargetEnabled', v)} label="Daily Revenue Target" sub="Show progress bar on dashboard" />
      {s.dailyTargetEnabled && (
        <div style={{ marginLeft: '20px', marginBottom: '12px', marginTop: '4px' }}>
          <Field label="Daily Target (₹)">
            <input style={{ ...inputStyle, width: '180px', fontFamily: "'DM Mono', monospace" }} type="number" min={0} value={s.dailyTarget} onChange={e => set('dailyTarget', parseInt(e.target.value) || 0)} placeholder="50000" />
          </Field>
        </div>
      )}
      <Toggle value={s.eodSummary} onChange={v => set('eodSummary', v)} label="End of Day Summary" sub="Show daily summary reminder at closing time" />
      {s.eodSummary && (
        <div style={{ marginLeft: '20px', marginBottom: '12px', marginTop: '4px' }}>
          <Field label="Closing time">
            <input style={{ ...inputStyle, width: '140px' }} type="time" value={s.eodTime} onChange={e => set('eodTime', e.target.value)} />
          </Field>
        </div>
      )}
      <SaveBtn onClick={save} />
    </Card>
  )
}

// ─── TAB 5: Data & Backup ────────────────────────────────────────────────────

function DataBackupTab() {
  const [dbStatus, setDbStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [dangerText, setDangerText] = useState('')
  const [resetText, setResetText] = useState('')
  const [cacheText, setCacheText] = useState('')

  const exportProducts = async () => {
    const { data } = await supabase.from('products').select('*, categories(name)')
    if (!data?.length) { toast.error('No products found'); return }
    downloadCSV('products.csv', data.map(p => [p.name, p.sku, p.barcode || '', p.unit_price, p.cost_price || '', p.gst_rate, p.stock_qty, p.low_stock_alert, p.categories?.name || '', p.is_active ? 'Active' : 'Inactive']),
      ['Name', 'SKU', 'Barcode', 'Price', 'Cost', 'GST%', 'Stock', 'Min Stock', 'Category', 'Status'])
    toast.success('Products exported!')
  }

  const exportCustomers = async () => {
    const { data } = await supabase.from('customers').select('*')
    if (!data?.length) { toast.error('No customers found'); return }
    downloadCSV('customers.csv', data.map(c => [c.name, c.phone, c.email || '', c.address || '', c.date_of_birth || '', c.loyalty_points, c.total_spent, c.created_at]),
      ['Name', 'Phone', 'Email', 'Address', 'Birthday', 'Loyalty Points', 'Total Spent', 'Created At'])
    toast.success('Customers exported!')
  }

  const exportSalesMonth = async () => {
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('sales').select('*, customers(name), users(name)').gte('created_at', from.toISOString())
    if (!data?.length) { toast.error('No sales this month'); return }
    downloadCSV(`sales_${new Date().toISOString().slice(0, 7)}.csv`,
      data.map(s => [s.invoice_no, s.customers?.name || 'Walk-in', s.net_amount, s.payment_mode, s.users?.name || '', s.created_at]),
      ['Invoice', 'Customer', 'Amount', 'Payment', 'Salesman', 'Date'])
    toast.success('Sales exported!')
  }

  const exportSalesAll = async () => {
    toast('Fetching all sales — may take a moment...', { icon: '⏳' })
    const { data } = await supabase.from('sales').select('*, customers(name), users(name)').order('created_at', { ascending: false })
    if (!data?.length) { toast.error('No sales found'); return }
    downloadCSV('sales_all.csv',
      data.map(s => [s.invoice_no, s.customers?.name || 'Walk-in', s.net_amount, s.payment_mode, s.users?.name || '', s.created_at]),
      ['Invoice', 'Customer', 'Amount', 'Payment', 'Salesman', 'Date'])
    toast.success(`${data.length} sales exported!`)
  }

  const testConnection = async () => {
    setDbStatus('checking')
    try {
      const { error } = await supabase.from('products').select('id').limit(1)
      setDbStatus(error ? 'error' : 'ok')
    } catch { setDbStatus('error') }
  }

  const clearTestData = async () => {
    if (dangerText !== 'CONFIRM') { toast.error('Type CONFIRM to proceed'); return }
    const { error } = await supabase.from('sales').delete().like('invoice_no', 'OFF-%')
    if (error) { toast.error(error.message) } else { toast.success('Test data cleared'); setDangerText('') }
  }

  // Every cache the app keeps in this browser, except erp_settings (shop name,
  // logo, bill conditions) which should survive a data reset. Without this, a
  // wiped database still shows the old products and can even re-sync old bills
  // from the pending queue.
  const clearLocalCache = () => {
    if (cacheText !== 'CONFIRM') { toast.error('Type CONFIRM to proceed'); return }
    const keys = [
      'gsoft_products_cache', 'gsoft_customers_cache', 'gsoft_credit_notes_cache',
      'gsoft_expenses_cache', 'gsoft_purchase_returns_cache', 'gsoft_pending_sales',
      'gsoft_salesmen_cache', 'expense_counter', 'purchase_counter',
    ]
    let removed = 0
    for (const k of keys) {
      if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); removed++ }
    }
    toast.success(`Cleared ${removed} cached item${removed === 1 ? '' : 's'}`)
    setCacheText('')
    setTimeout(() => window.location.reload(), 1000)
  }

  const resetSettings = () => {
    if (resetText !== 'CONFIRM') { toast.error('Type CONFIRM to proceed'); return }
    localStorage.removeItem('erp_settings')
    localStorage.removeItem('gsoft_shop_settings')
    toast.success('Settings reset to defaults')
    setResetText('')
    setTimeout(() => window.location.reload(), 1000)
  }

  const exportBtns = [
    { icon: '📦', label: 'Export Products', sub: 'All product details', onClick: exportProducts },
    { icon: '👥', label: 'Export Customers', sub: 'All customer data', onClick: exportCustomers },
    { icon: '🧾', label: 'Export Sales (This Month)', sub: 'Current month sales', onClick: exportSalesMonth },
    { icon: '📊', label: 'Export Sales (All Time)', sub: 'Full history — may be large', onClick: exportSalesAll },
  ]

  return (
    <>
      <Card>
        <SectionTitle sub="Download your data as CSV files">Export Data</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {exportBtns.map(b => (
            <button key={b.label} onClick={b.onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ fontSize: '24px' }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{b.label}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{b.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Connected database information">Database Info</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            ['Provider', 'Supabase'], ['Project', 'gsoft-erp'],
            ['Region', 'Mumbai, India'], ['Status', dbStatus === 'ok' ? '✅ Connected' : dbStatus === 'error' ? '❌ Error' : dbStatus === 'checking' ? '⏳ Checking...' : '⚪ Unknown'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e', marginTop: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={testConnection} style={{ padding: '9px 18px', background: 'white', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Test Connection
        </button>
      </Card>

      <Card style={{ border: '1px solid #fecaca' }}>
        <SectionTitle sub="These actions are irreversible — proceed with caution">⚠️ Danger Zone</SectionTitle>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '6px', fontSize: '13px' }}>Clear Test Data</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>Deletes all sales with invoice numbers starting with "OFF-" (offline test bills).</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inputStyle, width: '180px', padding: '8px 12px' }} placeholder='Type "CONFIRM"' value={dangerText} onChange={e => setDangerText(e.target.value)} />
            <button onClick={clearTestData} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Clear Test Data</button>
          </div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '6px', fontSize: '13px' }}>Clear Cached Data</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            Empties this browser's saved products, customers, credit notes and any unsynced bills.
            Use after clearing the database so old data cannot reappear. Shop settings are kept.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inputStyle, width: '180px', padding: '8px 12px' }} placeholder='Type "CONFIRM"' value={cacheText} onChange={e => setCacheText(e.target.value)} />
            <button onClick={clearLocalCache} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Clear Cache</button>
          </div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '6px', fontSize: '13px' }}>Reset App Settings</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>Clears all local settings. Does NOT delete any database data.</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...inputStyle, width: '180px', padding: '8px 12px' }} placeholder='Type "CONFIRM"' value={resetText} onChange={e => setResetText(e.target.value)} />
            <button onClick={resetSettings} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Reset Settings</button>
          </div>
        </div>
      </Card>
    </>
  )
}

// ─── TAB 6: About ────────────────────────────────────────────────────────────

function AboutTab() {
  const SHORTCUTS = [
    ['Ctrl+1', 'POS Billing'], ['Ctrl+2', 'Dashboard'], ['Ctrl+3', 'Products'],
    ['Ctrl+4', 'Inventory'], ['Ctrl+5', 'Customers'], ['Ctrl+6', 'Invoices'],
    ['Ctrl+7', 'Reports'],
  ]

  const checkUpdate = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      toast('Updates apply to the desktop app. The web version is always current.', { icon: 'ℹ️' })
      return
    }
    toast('Checking for updates…', { icon: '🔄' })
    const r = await window.electronAPI.checkForUpdates()
    if (!r.ok) { toast.error(r.reason || 'Could not reach the update server'); return }
    if (r.version && r.version !== r.current) {
      toast.success(`Version ${r.version} found — downloading. You will be asked to restart.`)
    } else {
      toast.success(`You are up to date (v${r.current || APP_VERSION})`)
    }
  }

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div style={{ width: '72px', height: '72px', background: '#9333ea', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '32px', fontWeight: 700, flexShrink: 0 }}>R</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a0a2e' }}>Retail ERP</div>
            <div style={{ fontSize: '14px', color: '#9333ea', fontWeight: 500 }}>Fashion Edition</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Version {APP_VERSION}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['React 19', 'Electron 41', 'Supabase', 'TypeScript', 'Vite 8'].map(t => (
            <span key={t} style={{ background: '#f5f3ff', color: '#9333ea', border: '1px solid #e9d5ff', padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Updates</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={checkUpdate} style={{ padding: '10px 20px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Check for Updates
          </button>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Current: v{APP_VERSION}</span>
        </div>
        <div style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontWeight: 600, color: '#1a0a2e', marginBottom: '8px', fontSize: '13px' }}>Update History</div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.8 }}>
            <strong style={{ color: '#9333ea' }}>v1.0.0</strong> — Initial release<br />
            POS billing, Products, Inventory, Customers, Reports, Offline mode, WhatsApp billing
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Support</SectionTitle>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: '#1a0a2e' }}>Built by GSoft, Ahmedabad</div>
          <div>📧 vatsal@gsoft.com</div>
        </div>
        <button
          onClick={() => window.open('https://wa.me/919999999999?text=' + encodeURIComponent(`Hi, I need support for Retail ERP v${APP_VERSION}`))}
          style={{ padding: '10px 18px', background: '#25D366', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
        >
          💬 WhatsApp Support
        </button>
      </Card>

      <Card>
        <SectionTitle sub="Quick navigation shortcuts">Keyboard Shortcuts</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map(([key, action]) => (
              <tr key={key} style={{ borderBottom: '1px solid #fdf8ff' }}>
                <td style={{ padding: '10px 0', width: '140px' }}>
                  <kbd style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#9333ea', fontWeight: 600 }}>{key}</kbd>
                </td>
                <td style={{ padding: '10px 0', fontSize: '13px', color: '#1a0a2e' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.1'

// ─── TAB: WhatsApp ───────────────────────────────────────────────────────────

function WhatsAppTab() {
  const [state, setState] = useState<WhatsAppState>({ status: 'disconnected' })
  const [serverUrl, setServerUrl] = useState(() => getSettings().waServerUrl || '')

  // A page served over https cannot reach http://localhost — Chrome blocks
  // public-to-private requests. Say so plainly rather than letting the shop
  // stare at a status that never turns green.
  const sameMachine =
    !serverUrl.trim() ||
    window.location.protocol !== 'https:' ||
    /^https:/i.test(serverUrl.trim())
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Hello from Retail ERP 👋')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const failures = useRef(0)
  const refresh = () =>
    waStatus()
      .then(s => { setState(s); setError(''); failures.current = 0 })
      .catch(e => {
        failures.current += 1
        const msg = String(e?.message || '')
        setError(/fetch|network|load failed/i.test(msg)
          ? 'The WhatsApp service is not running on this computer. Bills still work — pressing WhatsApp opens the chat with the message ready, and you press send.'
          : msg)
      })

  // Poll while pairing so the QR appears and the screen flips to connected on its own.
  useEffect(() => {
    if (!isRelayConfigured()) return
    refresh()
    const t = setInterval(() => {
      // Give up after a few failures; a shop PC with no service should not poll
      // a dead address every 2.5 seconds all day.
      if (failures.current >= 3) return
      refresh()
    }, 2500)
    return () => clearInterval(t)
  }, [serverUrl])

  const { status } = state
  const dot = { connected: '#16a34a', connecting: '#f59e0b', qr: '#f59e0b', disconnected: '#94a3b8' }[status]
  const label = {
    connected: 'Connected', connecting: 'Connecting…', qr: 'Scan the QR code', disconnected: 'Not connected'
  }[status]

  return (
    <>
      <Card>
        <SectionTitle sub="Link the shop's WhatsApp once — messages then send in the background">WhatsApp</SectionTitle>

        <Field
          label="WhatsApp Server Address"
          helper="Where the WhatsApp service is running. Leave blank to always open WhatsApp in a tab instead."
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="http://localhost:8099"
            />
            <button
              onClick={() => { saveSettings({ waServerUrl: serverUrl.trim() }); toast.success('Saved'); refresh() }}
              style={{
                padding: '10px 16px', background: '#9333ea', color: 'white', border: 'none',
                borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap'
              }}
            >
              Save
            </button>
          </div>
        </Field>

        {!sameMachine && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#92400e', lineHeight: 1.6, marginBottom: '18px' }}>
            This page is served from the internet but the address above is a local one.
            Browsers block that combination, so direct sending will not work here.
            Either open the app on the computer running the service, or host the service
            and put its <code>https://</code> address above.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a0a2e' }}>{label}</div>
          {state.name && <div style={{ fontSize: '12px', color: '#94a3b8' }}>· {state.name}</div>}
        </div>

        {status === 'qr' && state.qr && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src={state.qr} alt="WhatsApp QR" style={{ width: '260px', borderRadius: '12px', border: '1px solid #f3e8ff' }} />
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', lineHeight: 1.6 }}>
              On your phone open <b>WhatsApp → Settings → Linked devices → Link a device</b>,
              then point the camera here.
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#b91c1c', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          {status !== 'connected' && (
            <button
              onClick={async () => {
                setBusy(true)
                try { await waConnect(status === 'qr'); await refresh() }
                catch (e: any) { toast.error(e.message || 'Could not start WhatsApp') }
                finally { setBusy(false) }
              }}
              disabled={busy}
              style={{
                flex: 1, padding: '12px', background: '#9333ea', color: 'white', border: 'none',
                borderRadius: '12px', fontSize: '14px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1
              }}
            >
              {busy ? 'Starting…' : status === 'qr' ? 'Refresh QR' : 'Link WhatsApp'}
            </button>
          )}
          {status === 'connected' && (
            <button
              onClick={async () => {
                await waLogout().catch(() => {})
                await refresh()
                toast.success('WhatsApp unlinked')
              }}
              style={{
                flex: 1, padding: '12px', background: 'white', color: '#dc2626', border: '1px solid #fecaca',
                borderRadius: '12px', fontSize: '14px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer'
              }}
            >
              Unlink this device
            </button>
          )}
        </div>
      </Card>

      {status === 'connected' && (
        <Card>
          <SectionTitle sub="Send yourself a message to confirm it works">Test message</SectionTitle>
          <Field label="Phone number" helper="10 digits for India, or include the country code">
            <input style={inputStyle} value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Message">
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={testMsg} onChange={e => setTestMsg(e.target.value)} />
          </Field>
          <button
            onClick={async () => {
              if (!testPhone.trim()) return toast.error('Enter a phone number')
              setSending(true)
              await sendWhatsApp(testPhone, testMsg)
              setSending(false)
            }}
            disabled={sending}
            style={{
              width: '100%', padding: '13px', background: '#16a34a', color: 'white', border: 'none',
              borderRadius: '12px', fontSize: '14px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1
            }}
          >
            {sending ? 'Sending…' : 'Send test message'}
          </button>
        </Card>
      )}

      <Card style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.7 }}>
          <b>Please read.</b> This links your own WhatsApp account the same way WhatsApp Web does.
          It is not WhatsApp's official business API, and automated sending is against their terms —
          heavy or bulk-looking activity can get the number blocked. Use it for bills and reminders
          to customers who expect them, not for marketing blasts. Keep the phone online and connected
          to the internet, or messages will not go out.
        </div>
      </Card>
    </>
  )
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────

type Tab = 'shop' | 'print' | 'staff' | 'whatsapp' | 'notifications' | 'data' | 'about'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'shop',          icon: '🏪', label: 'Shop Info' },
  { id: 'print',         icon: '🖨️', label: 'Bill & Print' },
  { id: 'staff',         icon: '👥', label: 'Staff & PIN' },
  { id: 'whatsapp',      icon: '💬', label: 'WhatsApp' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'data',          icon: '💾', label: 'Data & Backup' },
  { id: 'about',         icon: 'ℹ️', label: 'About' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('shop')

  return (
    <Layout>
      <div style={{ display: 'flex', gap: '20px', padding: '24px', background: '#fdf8ff', minHeight: '100%', fontFamily: "'DM Sans', sans-serif" }}>

        {/* Left tab list */}
        <div style={{ width: '200px', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, color: '#1a0a2e', fontSize: '18px', marginBottom: '20px', padding: '0 4px' }}>Settings</div>
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px', textAlign: 'left',
                  background: active ? '#f5f3ff' : 'transparent',
                  color: active ? '#9333ea' : '#64748b',
                  border: 'none',
                  borderLeft: `3px solid ${active ? '#9333ea' : 'transparent'}`,
                  borderRadius: '0 8px 8px 0',
                  fontSize: '13px', fontWeight: active ? 600 : 400,
                  cursor: 'pointer', marginBottom: '2px',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'shop'          && <ShopInfoTab />}
          {activeTab === 'print'         && <BillPrintTab />}
          {activeTab === 'staff'         && <StaffPINTab />}
          {activeTab === 'whatsapp'      && <WhatsAppTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'data'          && <DataBackupTab />}
          {activeTab === 'about'         && <AboutTab />}
        </div>
      </div>
    </Layout>
  )
}
