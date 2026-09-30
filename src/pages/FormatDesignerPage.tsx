import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import toast from 'react-hot-toast'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import { getSettings, saveSettings, billPrintWidthMm, type AppSettings } from '../utils/settings'
import {
  LABEL_FIELDS, BILL_COL_NAMES, PT_TO_MM, defaultLabelDesign, defaultBillDesign, labelFieldText,
  type LabelDesign, type LabelEl, type LabelField, type LabelValues, type BillDesign, type Align,
} from '../utils/formatDesigns'
import { buildBillHTML, printBill } from '../utils/printBill'
import { printBarcodeLabels } from '../utils/printLabels'

// ─── look ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: 'white', border: '1px solid #f3e8ff', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }
const h2: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }
const hint: React.CSSProperties = { fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.45, margin: 0 }
const input: React.CSSProperties = { width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '7px 9px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', background: 'white', color: '#1a0a2e' }
const btn: React.CSSProperties = { border: '1px solid #e9d5ff', background: 'white', color: '#6b21a8', borderRadius: '9px', padding: '7px 11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }
const btnMain: React.CSSProperties = { ...btn, background: '#9333ea', color: 'white', borderColor: '#9333ea' }
const small: React.CSSProperties = { fontSize: '11px', color: '#64748b', fontWeight: 600 }
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))

function Num({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <span style={small}>{label}</span>
    <input type="number" step={step} style={{ ...input, fontFamily: 'DM Mono, monospace' }} value={value} onChange={e => onChange(Number(e.target.value))} />
  </label>
}
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#9333ea', width: '15px', height: '15px' }} />
    {label}
  </label>
}
function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div style={{ display: 'flex', border: '1px solid #e9d5ff', borderRadius: '8px', overflow: 'hidden' }}>
    {options.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} style={{
      flex: 1, border: 0, padding: '6px 0', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
      background: value === v ? '#f3e8ff' : 'white', color: value === v ? '#9333ea' : '#64748b' }}>{l}</button>)}
  </div>
}

/** The format picker, rename, copy and "use for printing" bar shared by both tabs. */
function FormatBar({ names, index, active, onPick, onRename, onDuplicate, onReset, onDelete, onUse, onSave, onTest, dirty }: {
  names: string[]; index: number; active: number; dirty: boolean
  onPick: (i: number) => void; onRename: (n: string) => void; onDuplicate: () => void; onReset: () => void
  onDelete: () => void; onUse: (i: number) => void; onSave: () => void; onTest: () => void
}) {
  const inUse = active === index
  return <div style={{ ...card, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
    <select style={{ ...input, width: 'auto', minWidth: '170px' }} value={index} onChange={e => onPick(Number(e.target.value))}>
      {names.map((n, i) => <option key={i} value={i}>{n}{active === i ? '  ✓ in use' : ''}</option>)}
    </select>
    <input style={{ ...input, width: '180px' }} value={names[index] || ''} onChange={e => onRename(e.target.value)} aria-label="Format name" />
    <button style={btn} onClick={onDuplicate}>Duplicate</button>
    <button style={btn} onClick={onReset}>Reset to standard</button>
    {names.length > 1 && <button style={{ ...btn, color: '#c2410c' }} onClick={onDelete}>Delete</button>}
    <span style={{ flex: 1 }} />
    {inUse
      ? <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: '99px', padding: '5px 11px' }}>✓ Printing with this format</span>
      : <button style={btn} onClick={() => onUse(index)}>Use for printing</button>}
    {active >= 0 && <button style={{ ...btn, color: '#64748b' }} onClick={() => onUse(-1)} title="Go back to the layout the app shipped with">Use built-in</button>}
    <button style={btn} onClick={onTest}>Save & test print</button>
    <button style={{ ...btnMain, opacity: dirty ? 1 : 0.6 }} onClick={onSave}>{dirty ? 'Save' : 'Saved'}</button>
  </div>
}

// ─── sample data ────────────────────────────────────────────────────────────
const FALLBACK_PRODUCT = { name: 'Sample', categories: { name: 'KURTIS' }, design_no: '803291', pcode: '24', size: '3XL', colour: 'Navy', mrp: 1450, unit_price: 1450, barcode: '44943', batch_no: 'B2409' }
const valuesOf = (p: any, shopName: string): LabelValues => ({
  shopName, category: p.categories?.name || p.category || p.name || '', designNo: p.design_no || '', pcode: p.pcode || '',
  size: p.size || '', colour: p.colour || '', mrp: p.mrp || p.unit_price || 0, price: p.unit_price || 0,
  barcode: p.barcode || p.batch_no || p.sku || '', batchNo: p.batch_no || p.sku || '',
})
const SAMPLE_SALE = {
  invoiceNo: 'INV-0012',
  cart: [
    { product: { category: 'PANTS', barcode: '45265', design_no: '2353', size: '42', colour: 'Black', hsn_code: '6204' }, qty: 1, unit_price: 1400, discount_pct: 0, line_total: 1400 },
    { product: { category: 'TOP', barcode: '45792', design_no: '4375', size: '3XL', hsn_code: '6206' }, qty: 1, unit_price: 950, discount_pct: 0, line_total: 950 },
    { product: { category: 'KURTI SET LONG', barcode: '44562', design_no: '803291', size: '3XL-4XL', hsn_code: '6204' }, qty: 2, unit_price: 1050, discount_pct: 0, line_total: 2100 },
  ],
  customer: { name: 'Rekha', phone: '8488004851' },
  subtotal: 4450, gstAmount: 202.38, totalDiscount: 200, netAmount: 4250, paymentMode: 'upi',
  tenders: { cash: 250, card: 0, upi: 4000 }, creditRemainder: 0, salesmanName: 'aadil', date: new Date().toISOString(),
}

// ─── page ───────────────────────────────────────────────────────────────────
export function FormatDesignerPage() {
  const [tab, setTab] = useState<'label' | 'bill'>('label')
  const [s, setS] = useState<AppSettings>(() => getSettings())
  const [dirty, setDirty] = useState(false)

  const [labels, setLabels] = useState<LabelDesign[]>(() =>
    s.labelDesigns?.length ? clone(s.labelDesigns) : [defaultLabelDesign(s.labelWidthMm, s.labelHeightMm)])
  const [li, setLi] = useState(() => Math.max(0, s.activeLabelDesign))
  const [bills, setBills] = useState<BillDesign[]>(() =>
    s.billDesigns?.length ? s.billDesigns.map(d => ({ ...defaultBillDesign(s), ...clone(d) })) : [defaultBillDesign(s)])
  const [bi, setBi] = useState(() => Math.max(0, s.activeBillDesign))

  const touch = () => setDirty(true)
  const setLabel = (fn: (d: LabelDesign) => void) => { setLabels(ls => { const n = clone(ls); fn(n[li]); return n }); touch() }
  const setBill = (fn: (d: BillDesign) => void) => { setBills(bs => { const n = clone(bs); fn(n[bi]); return n }); touch() }
  const setShop = (patch: Partial<AppSettings>) => { setS(x => ({ ...x, ...patch })); touch() }

  const save = (patch: Partial<AppSettings> = {}) => {
    const next: Partial<AppSettings> = {
      labelDesigns: labels, billDesigns: bills,
      shopName: s.shopName, shopTagline: s.shopTagline, shopAddress: s.shopAddress, shopPhone: s.shopPhone,
      gstin: s.gstin, billTerms: s.billTerms, billFooter: s.billFooter,
      activeLabelDesign: s.activeLabelDesign, activeBillDesign: s.activeBillDesign, ...patch,
    }
    saveSettings(next)                 // also publishes to the shop's other counters
    setS(getSettings()); setDirty(false)
  }
  const use = (kind: 'label' | 'bill', i: number) => {
    save(kind === 'label' ? { activeLabelDesign: i } : { activeBillDesign: i })
    toast.success(i < 0 ? 'Back to the built-in format' : 'Bills/labels now print with this format')
  }
  // Leaving with unsaved edits loses them; say so.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault() } }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return (
    <Layout>
      <div style={{ padding: '20px 24px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Bill & Label Designer</h1>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Design the barcode label and sales bill. Saved formats reach every counter.</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: '#f3e8ff', padding: '4px', borderRadius: '12px' }}>
            {(['label', 'bill'] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{
              border: 0, padding: '8px 16px', borderRadius: '9px', fontWeight: 600, cursor: 'pointer', fontSize: '13px',
              background: tab === t ? 'white' : 'transparent', color: tab === t ? '#9333ea' : '#6b7280' }}>
              {t === 'label' ? 'Barcode label' : 'Sales bill'}</button>)}
          </div>
        </div>

        {tab === 'label' ? (
          <>
            <FormatBar names={labels.map(l => l.name)} index={li} active={s.activeLabelDesign} dirty={dirty}
              onPick={setLi} onRename={n => setLabel(d => { d.name = n })}
              onDuplicate={() => { setLabels(ls => [...ls, { ...clone(ls[li]), name: ls[li].name + ' (copy)' }]); setLi(labels.length); touch() }}
              onReset={() => setLabel(d => { const f = defaultLabelDesign(s.labelWidthMm, s.labelHeightMm); d.els = f.els; d.w = f.w; d.h = f.h })}
              onDelete={() => { const act = s.activeLabelDesign; setLabels(ls => ls.filter((_, i) => i !== li));
                if (act === li) setS(x => ({ ...x, activeLabelDesign: -1 })); else if (act > li) setS(x => ({ ...x, activeLabelDesign: act - 1 }))
                setLi(0); touch() }}
              onUse={i => use('label', i)} onSave={() => { save(); toast.success('Saved') }}
              onTest={() => { if (s.activeLabelDesign !== li) { toast.error('Tap “Use for printing” first — a test prints the format in use'); return }
                save(); printBarcodeLabels([sampleProductRef.current], 1) }} />
            <LabelEditor design={labels[li]} settings={s} onChange={setLabel} sampleRef={sampleProductRef} />
          </>
        ) : (
          <>
            <FormatBar names={bills.map(b => b.name)} index={bi} active={s.activeBillDesign} dirty={dirty}
              onPick={setBi} onRename={n => setBill(d => { d.name = n })}
              onDuplicate={() => { setBills(bs => [...bs, { ...clone(bs[bi]), name: bs[bi].name + ' (copy)' }]); setBi(bills.length); touch() }}
              onReset={() => setBill(d => { Object.assign(d, { ...defaultBillDesign(s), name: d.name }) })}
              onDelete={() => { const act = s.activeBillDesign; setBills(bs => bs.filter((_, i) => i !== bi));
                if (act === bi) setS(x => ({ ...x, activeBillDesign: -1 })); else if (act > bi) setS(x => ({ ...x, activeBillDesign: act - 1 }))
                setBi(0); touch() }}
              onUse={i => use('bill', i)} onSave={() => { save(); toast.success('Saved') }}
              onTest={() => { if (s.activeBillDesign !== bi) { toast.error('Tap “Use for printing” first — a test prints the format in use'); return }
                save(); printBill(SAMPLE_SALE) }} />
            <BillEditor design={bills[bi]} settings={s} onChange={setBill} onShop={setShop} />
          </>
        )}
      </div>
    </Layout>
  )
}
// The product the label test print uses — whatever is picked in the label editor.
const sampleProductRef: { current: any } = { current: FALLBACK_PRODUCT }

// ─── label editor ───────────────────────────────────────────────────────────
const SCALE = 10   // screen px per mm
const snap = (v: number) => Math.round(v * 2) / 2

function ElView({ el, v, s, selected }: { el: LabelEl; v: LabelValues; s: number; selected?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (el.t !== 'barcode' || !svgRef.current || !v.barcode) return
    try { JsBarcode(svgRef.current, v.barcode, { format: 'CODE128', displayValue: false, margin: 0, height: 100, width: 2 })
          svgRef.current.setAttribute('preserveAspectRatio', 'none') } catch { /* unencodable code: leave blank */ }
  }, [el.t, v.barcode])
  const style: React.CSSProperties = {
    position: 'absolute', left: el.x * s, top: el.y * s, width: el.w * s, height: el.h * s, overflow: 'hidden',
    outline: selected ? '1.5px solid #9333ea' : undefined, outlineOffset: 1, background: el.t === 'line' ? '#000' : selected ? 'rgba(147,51,234,.06)' : undefined,
  }
  if (el.t === 'barcode') return <div style={style}><svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} /></div>
  if (el.t === 'line') return <div style={style} />
  return <div style={{ ...style, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', lineHeight: 1.1,
    justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center',
    fontSize: el.pt * PT_TO_MM * s, fontWeight: el.bold ? 800 : 500, fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
    {labelFieldText(el, v)}
  </div>
}

function LabelEditor({ design, settings, onChange, sampleRef }: {
  design: LabelDesign; settings: AppSettings; onChange: (fn: (d: LabelDesign) => void) => void; sampleRef: { current: any }
}) {
  const [sel, setSel] = useState(0)
  const [products, setProducts] = useState<any[]>([FALLBACK_PRODUCT])
  const [pi, setPi] = useState(0)
  const [grid, setGrid] = useState(true)
  const canvas = useRef<HTMLDivElement>(null)
  useEffect(() => {
    supabase.from('products').select('*, categories(name)').eq('is_active', true).order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => { if (data?.length) setProducts(data) })
  }, [])
  const product = products[pi] || FALLBACK_PRODUCT
  sampleRef.current = product
  const v = valuesOf(product, settings.shopName || 'Retail ERP')
  const el = design.els[sel]
  const sizeMismatch = design.w !== settings.labelWidthMm || design.h !== settings.labelHeightMm

  const add = (k: LabelField | '@barcode' | '@text' | '@line') => {
    const w = design.w, h = design.h
    const e: LabelEl = k === '@barcode' ? { t: 'barcode', x: 3, y: h / 2, w: w - 6, h: 8 }
      : k === '@line' ? { t: 'line', x: 2, y: h / 2, w: w - 4, h: 0.4 }
      : k === '@text' ? { t: 'text', text: 'Incl. of all taxes', x: 2, y: h / 2, w: w - 4, h: 4, pt: 7, bold: false, align: 'center' }
      : { t: 'field', f: k, x: 2, y: h / 2, w: w - 4, h: 4, pt: 9, bold: false, align: 'center', pre: ({ mrp: 'MRP ₹', price: '₹', size: 'Size: ' } as any)[k] || '' }
    onChange(d => { d.els.push(e) }); setSel(design.els.length)
  }
  const del = () => { onChange(d => { d.els.splice(sel, 1) }); setSel(i => Math.max(0, i - 1)) }
  const setEl = (patch: Partial<LabelEl>) => onChange(d => { Object.assign(d.els[sel], patch) })

  const onPointerDown = (ev: React.PointerEvent, i: number, resize: boolean) => {
    ev.preventDefault(); ev.stopPropagation(); setSel(i); canvas.current?.focus({ preventScroll: true })
    const o = { ...design.els[i] }, sx = ev.clientX, sy = ev.clientY
    const move = (m: PointerEvent) => {
      const dx = (m.clientX - sx) / SCALE, dy = (m.clientY - sy) / SCALE
      onChange(d => {
        const e = d.els[i]
        if (resize) { e.w = Math.max(1, snap(o.w + dx)); e.h = Math.max(e.t === 'line' ? 0.3 : 1, snap(o.h + dy)) }
        else { e.x = Math.min(d.w - e.w, Math.max(0, snap(o.x + dx))); e.y = Math.min(d.h - e.h, Math.max(0, snap(o.y + dy))) }
      })
    }
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up) }
    addEventListener('pointermove', move); addEventListener('pointerup', up)
  }
  const onKey = (ev: React.KeyboardEvent) => {
    if (!el) return
    const st = ev.shiftKey ? 2 : 0.5
    const mv = ({ ArrowLeft: ['x', -st], ArrowRight: ['x', st], ArrowUp: ['y', -st], ArrowDown: ['y', st] } as any)[ev.key]
    if (mv) { ev.preventDefault(); setEl({ [mv[0]]: Math.max(0, +((el as any)[mv[0]] + mv[1]).toFixed(1)) } as any) }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); del() }
  }
  const nameOf = (e: LabelEl) => e.t === 'field' ? LABEL_FIELDS[e.f] : e.t === 'barcode' ? 'Barcode' : e.t === 'line' ? 'Line' : `Text: ${e.text}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr) 270px', gap: '12px', alignItems: 'start' }}>
      <div style={card}>
        <h3 style={h2}>Add to label</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(Object.keys(LABEL_FIELDS) as LabelField[]).map(k => <button key={k} style={{ ...btn, textAlign: 'left', fontWeight: 500 }} onClick={() => add(k)}>{LABEL_FIELDS[k]}</button>)}
          <button style={{ ...btn, textAlign: 'left', fontWeight: 500 }} onClick={() => add('@barcode')}>▮▯▮ Barcode</button>
          <button style={{ ...btn, textAlign: 'left', fontWeight: 500 }} onClick={() => add('@text')}>Custom text</button>
          <button style={{ ...btn, textAlign: 'left', fontWeight: 500 }} onClick={() => add('@line')}>Line</button>
        </div>
        <h3 style={h2}>On this label</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '230px', overflow: 'auto' }}>
          {design.els.map((e, i) => <button key={i} onClick={() => setSel(i)} style={{
            display: 'flex', justifyContent: 'space-between', border: `1px solid ${i === sel ? '#9333ea' : 'transparent'}`,
            background: i === sel ? '#f3e8ff' : '#faf5ff', color: i === sel ? '#9333ea' : '#1a0a2e', borderRadius: '7px', padding: '6px 8px', cursor: 'pointer', fontSize: '12px' }}>
            <span>{nameOf(e)}</span><small style={{ fontFamily: 'DM Mono, monospace', color: '#94a3b8' }}>{e.x},{e.y}</small></button>)}
        </div>
        <p style={hint}>Drag to move, drag the corner square to resize. Arrow keys nudge 0.5 mm (Shift = 2 mm). Delete removes.</p>
      </div>

      <div style={{ background: '#ece6f3', borderRadius: '14px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', overflow: 'auto', minHeight: '440px' }}>
        <div ref={canvas} tabIndex={0} onKeyDown={onKey} aria-label="Label canvas" style={{
          position: 'relative', width: design.w * SCALE, height: design.h * SCALE, background: 'white', borderRadius: '6px', outline: 'none',
          boxShadow: '0 2px 10px rgba(30,10,50,.18)', touchAction: 'none', userSelect: 'none',
          backgroundImage: grid ? 'linear-gradient(rgba(147,51,234,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(147,51,234,.07) 1px,transparent 1px)' : undefined,
          backgroundSize: `${SCALE}px ${SCALE}px` }}>
          {design.els.map((e, i) => (
            <div key={i} onPointerDown={ev => onPointerDown(ev, i, false)} style={{ cursor: 'move' }}>
              <ElView el={e} v={v} s={SCALE} selected={i === sel} />
              {i === sel && <div onPointerDown={ev => onPointerDown(ev, i, true)} style={{
                position: 'absolute', left: (e.x + e.w) * SCALE - 8, top: (e.y + e.h) * SCALE - 8, width: 10, height: 10,
                background: '#9333ea', border: '2px solid white', borderRadius: 2, cursor: 'nwse-resize' }} />}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{design.w} × {design.h} mm</div>
        {sizeMismatch && <div style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', borderRadius: '8px', padding: '6px 10px', maxWidth: '360px', textAlign: 'center' }}>
          The label printer is set for {settings.labelWidthMm} × {settings.labelHeightMm} mm stock (Settings → Bill & Print). Match the sizes, or items may be cut off.</div>}
        <div style={{ fontSize: '11px', color: '#64748b' }}>Off the roll, {settings.labelColumns || 2} across</div>
        <div style={{ display: 'flex', gap: `${(settings.labelColumnGapMm || 2) * 3.2}px`, background: '#d9cfe6', padding: 6, borderRadius: 6 }}>
          {Array.from({ length: settings.labelColumns || 2 }).map((_, k) => (
            <div key={k} style={{ position: 'relative', width: design.w * 3.2, height: design.h * 3.2, background: 'white', overflow: 'hidden', borderRadius: 2 }}>
              {design.els.map((e, i) => <ElView key={i} el={e} v={v} s={3.2} />)}
            </div>))}
        </div>
      </div>

      <div style={card}>
        <h3 style={h2}>Selected item</h3>
        {!el ? <p style={hint}>Click an item on the label to change it.</p> : <>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{nameOf(el)}</div>
          {el.t === 'field' && <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Shows</span>
              <select style={input} value={el.f} onChange={e => setEl({ f: e.target.value as LabelField })}>
                {(Object.keys(LABEL_FIELDS) as LabelField[]).map(k => <option key={k} value={k}>{LABEL_FIELDS[k]}</option>)}
              </select></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Text before (e.g. “MRP ₹”)</span>
              <input style={input} value={el.pre} onChange={e => setEl({ pre: e.target.value })} /></label>
          </>}
          {el.t === 'text' && <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Text</span>
            <input style={input} value={el.text} onChange={e => setEl({ text: e.target.value })} /></label>}
          {(el.t === 'field' || el.t === 'text') && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'end' }}>
              <Num label="Font size (pt)" value={el.pt} onChange={pt => setEl({ pt })} />
              <Seg value={el.bold ? 'b' : 'n'} options={[['n', 'Normal'], ['b', 'Bold']]} onChange={x => setEl({ bold: x === 'b' })} />
            </div>
            <Seg<Align> value={el.align} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={align => setEl({ align })} />
          </>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Num label="X (mm)" value={el.x} onChange={x => setEl({ x })} />
            <Num label="Y (mm)" value={el.y} onChange={y => setEl({ y })} />
            <Num label="Width (mm)" value={el.w} onChange={w => setEl({ w })} />
            <Num label="Height (mm)" value={el.h} onChange={h => setEl({ h })} />
          </div>
          {el.t === 'barcode' && <p style={hint}>Printed by the barcode printer itself (Code 128), so the bars stay sharp. One barcode per label.</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btn} onClick={() => setEl({ x: +((design.w - el.w) / 2).toFixed(1) })}>Centre across</button>
            <button style={{ ...btn, color: '#c2410c' }} onClick={del}>Remove</button>
          </div>
        </>}
        <h3 style={{ ...h2, marginTop: '6px' }}>Label size</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Num label="Width (mm)" step={1} value={design.w} onChange={w => onChange(d => { d.w = Math.max(15, w) })} />
          <Num label="Height (mm)" step={1} value={design.h} onChange={h => onChange(d => { d.h = Math.max(10, h) })} />
        </div>
        <Check label="Show grid" value={grid} onChange={setGrid} />
        <h3 style={{ ...h2, marginTop: '6px' }}>Preview with</h3>
        <select style={input} value={pi} onChange={e => setPi(Number(e.target.value))}>
          {products.map((p, i) => <option key={p.id || i} value={i}>{(p.categories?.name || p.name)} · {p.size || '-'} · ₹{p.mrp || p.unit_price}</option>)}
        </select>
      </div>
    </div>
  )
}

// ─── bill editor ────────────────────────────────────────────────────────────
function BillEditor({ design, settings, onChange, onShop }: {
  design: BillDesign; settings: AppSettings; onChange: (fn: (d: BillDesign) => void) => void; onShop: (p: Partial<AppSettings>) => void
}) {
  const set = <K extends keyof BillDesign>(k: K) => (v: BillDesign[K]) => onChange(d => { d[k] = v })
  const html = useMemo(() => buildBillHTML(SAMPLE_SALE, settings, design), [settings, design])
  const widthMm = billPrintWidthMm(settings)
  const colTotal = design.cols.filter(c => c.on).reduce((n, c) => n + Number(c.w || 0), 0)
  const move = (i: number, dir: -1 | 1) => onChange(d => { const j = i + dir; if (j < 0 || j >= d.cols.length) return; [d.cols[i], d.cols[j]] = [d.cols[j], d.cols[i]] })
  const shopText = (k: keyof AppSettings, label: string, multi = false) =>
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>{label}</span>
      {multi
        ? <textarea rows={2} style={{ ...input, resize: 'vertical' }} value={String(settings[k] ?? '')} onChange={e => onShop({ [k]: e.target.value } as any)} />
        : <input style={input} value={String(settings[k] ?? '')} onChange={e => onShop({ [k]: e.target.value } as any)} />}
    </label>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '270px minmax(0,1fr) 300px', gap: '12px', alignItems: 'start' }}>
      <div style={card}>
        <h3 style={h2}>Header</h3>
        <Check label={settings.shopLogo ? 'Logo' : 'Logo (add one in Settings → Shop)'} value={design.showLogo} onChange={set('showLogo')} />
        <Check label="Shop name" value={design.showShopName} onChange={set('showShopName')} />
        {design.showShopName && <>{shopText('shopName', 'Shop name')}<Num label="Name size (px)" step={1} value={design.shopNameSize} onChange={set('shopNameSize')} /></>}
        <Check label="Tag line" value={design.showTagline} onChange={set('showTagline')} />
        {design.showTagline && shopText('shopTagline', 'Tag line')}
        <Check label="Address" value={design.showAddress} onChange={set('showAddress')} />
        {design.showAddress && shopText('shopAddress', 'Address', true)}
        <Check label="Phone" value={design.showPhone} onChange={set('showPhone')} />
        {design.showPhone && shopText('shopPhone', 'Phone')}
        <Check label="GSTIN" value={design.showGstin} onChange={set('showGstin')} />
        {design.showGstin && shopText('gstin', 'GSTIN')}
        <h3 style={{ ...h2, marginTop: '6px' }}>Bill details</h3>
        <Check label="Customer phone & name" value={design.showCustomer} onChange={set('showCustomer')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Bill no. label</span><input style={input} value={design.billNoLabel} onChange={e => set('billNoLabel')(e.target.value)} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Date label</span><input style={input} value={design.dateLabel} onChange={e => set('dateLabel')(e.target.value)} /></label>
        </div>
      </div>

      <div style={{ background: '#ece6f3', borderRadius: '14px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', overflow: 'auto' }}>
        {/* The real bill builder — this is exactly what prints and what goes out as the PDF. */}
        <iframe title="Bill preview" srcDoc={html} style={{
          width: `calc(${widthMm}mm + 2px)`, height: '900px', border: 0, background: 'white',
          boxShadow: '0 2px 12px rgba(30,10,50,.2)', zoom: 1.25 } as React.CSSProperties} />
        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{widthMm} mm printable · sample bill · shown 1.25×</div>
      </div>

      <div style={card}>
        <h3 style={h2}>Item columns</h3>
        <p style={hint}>Tick to show, rename the heading, set width (%) and order.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {design.cols.map((c, i) => (
            <div key={c.k} title={BILL_COL_NAMES[c.k]} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 52px 22px', gap: '6px', alignItems: 'center',
              background: '#faf5ff', borderRadius: '8px', padding: '5px 6px', opacity: c.on ? 1 : 0.55 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button aria-label="Move up" onClick={() => move(i, -1)} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', color: '#64748b' }}>▲</button>
                <button aria-label="Move down" onClick={() => move(i, 1)} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', color: '#64748b' }}>▼</button>
              </div>
              <input style={{ ...input, padding: '4px 6px' }} value={c.label} onChange={e => onChange(d => { d.cols[i].label = e.target.value })} aria-label={`Heading for ${BILL_COL_NAMES[c.k]}`} />
              <input type="number" style={{ ...input, padding: '4px 5px', fontFamily: 'DM Mono, monospace' }} value={c.w} onChange={e => onChange(d => { d.cols[i].w = Number(e.target.value) })} aria-label="Width %" />
              <input type="checkbox" checked={c.on} onChange={e => onChange(d => { d.cols[i].on = e.target.checked })} style={{ accentColor: '#9333ea', width: '15px', height: '15px' }} aria-label={`Show ${BILL_COL_NAMES[c.k]}`} />
            </div>))}
        </div>
        <div style={{ fontSize: '11px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: colTotal === 100 ? '#16a34a' : '#b45309' }}>
          Widths add up to {colTotal}%{colTotal === 100 ? ' ✓' : ' — aim for 100%'}</div>

        <h3 style={{ ...h2, marginTop: '6px' }}>Totals</h3>
        <Check label="Total row (qty & amount)" value={design.showTotalRow} onChange={set('showTotalRow')} />
        <Check label="Discount" value={design.showDiscount} onChange={set('showDiscount')} />
        <Check label="GST (CGST + SGST)" value={design.showGst} onChange={set('showGst')} />
        <Check label="Round off" value={design.showRound} onChange={set('showRound')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={small}>Net label</span><input style={input} value={design.netLabel} onChange={e => set('netLabel')(e.target.value)} /></label>
          <Num label="Net size (px)" step={1} value={design.netSize} onChange={set('netSize')} />
        </div>

        <h3 style={{ ...h2, marginTop: '6px' }}>Footer</h3>
        <Check label="Salesman" value={design.showSalesman} onChange={set('showSalesman')} />
        <Check label="Terms" value={design.showTerms} onChange={set('showTerms')} />
        {design.showTerms && shopText('billTerms', 'Terms (one per line)', true)}
        <Check label="Time" value={design.showTime} onChange={set('showTime')} />
        <Check label="Payment details" value={design.showPayment} onChange={set('showPayment')} />
        <Check label="Closing line" value={design.showFooter} onChange={set('showFooter')} />
        {design.showFooter && shopText('billFooter', 'Closing line')}
      </div>
    </div>
  )
}
