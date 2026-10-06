// E-way bill for a wholesale invoice.
//
// The JSON follows the NIC portal's bulk-generation format
// (ewaybillgst.gov.in → e-Waybill → Generate Bulk), so the shop uploads the file
// and the portal issues the e-way bill number. The PDF is the same bill laid out
// on A4 for the file and the transporter.
import { fmtDate } from './date'

/** GST state codes, as the portal expects them. */
export const STATE_CODES: Record<string, number> = {
  'Jammu and Kashmir': 1, 'Himachal Pradesh': 2, 'Punjab': 3, 'Chandigarh': 4, 'Uttarakhand': 5, 'Haryana': 6,
  'Delhi': 7, 'Rajasthan': 8, 'Uttar Pradesh': 9, 'Bihar': 10, 'Sikkim': 11, 'Arunachal Pradesh': 12,
  'Nagaland': 13, 'Manipur': 14, 'Mizoram': 15, 'Tripura': 16, 'Meghalaya': 17, 'Assam': 18, 'West Bengal': 19,
  'Jharkhand': 20, 'Odisha': 21, 'Chhattisgarh': 22, 'Madhya Pradesh': 23, 'Gujarat': 24,
  'Dadra and Nagar Haveli and Daman and Diu': 26, 'Maharashtra': 27, 'Karnataka': 29, 'Goa': 30,
  'Lakshadweep': 31, 'Kerala': 32, 'Tamil Nadu': 33, 'Puducherry': 34, 'Andaman and Nicobar Islands': 35,
  'Telangana': 36, 'Andhra Pradesh': 37, 'Ladakh': 38,
}

/** A state name (any case, or a GSTIN's first two digits) to its code. */
export function stateCode(state?: string, gstin?: string): number {
  const fromGstin = Number(String(gstin || '').slice(0, 2))
  if (fromGstin >= 1 && fromGstin <= 38) return fromGstin
  const k = Object.keys(STATE_CODES).find(n => n.toLowerCase() === String(state || '').trim().toLowerCase())
  return k ? STATE_CODES[k] : 0
}

export const TRANS_MODES: Record<string, string> = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' }

export interface EwayParty { gstin: string; name: string; addr1: string; addr2: string; place: string; pincode: string; state: string }
export interface EwayItem { name: string; desc: string; hsn: string; qty: number; taxable: number; gstRate: number }
export interface EwayForm {
  docNo: string; docDate: string            // docDate as yyyy-mm-dd
  from: EwayParty; to: EwayParty
  igst: boolean                             // inter-state
  items: EwayItem[]
  othValue: number                          // freight and other charges on the invoice
  totInvValue: number
  transMode: string; distanceKm: number
  transporterName: string; transporterId: string; transDocNo: string; transDocDate: string; vehicleNo: string
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const ddmmyyyy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

/** Things the portal would reject, in words the shop can act on. */
export function ewayProblems(f: EwayForm): string[] {
  const p: string[] = []
  if (!GSTIN_RE.test(f.from.gstin)) p.push('Your shop GSTIN is missing or not valid (Settings → Shop).')
  if (f.to.gstin && !GSTIN_RE.test(f.to.gstin)) p.push('The party GSTIN is not valid — leave it blank for an unregistered buyer.')
  for (const [who, x] of [['Your shop', f.from], ['The party', f.to]] as const) {
    if (!/^[1-9][0-9]{5}$/.test(x.pincode)) p.push(`${who}: PIN code must be 6 digits.`)
    if (!stateCode(x.state, x.gstin)) p.push(`${who}: choose the state.`)
    if (!x.name.trim()) p.push(`${who}: name is missing.`)
    if (!x.place.trim()) p.push(`${who}: place (city) is missing.`)
  }
  f.items.forEach((it, i) => { if (!/^[0-9]{4,8}$/.test(it.hsn)) p.push(`Item ${i + 1} (${it.name}): HSN must be 4–8 digits.`) })
  if (f.distanceKm < 0 || f.distanceKm > 4000) p.push('Distance must be 0–4000 km (0 lets the portal work it out from the PIN codes).')
  if (f.transMode === '1' && !f.transporterId && !/^[A-Z]{2}[0-9A-Z]{1,3}[A-Z]{0,3}[0-9]{4}$/.test(f.vehicleNo.replace(/[\s-]/g, '').toUpperCase()))
    p.push('By road: enter the vehicle number (e.g. GJ05AB1234), or a transporter ID.')
  return p
}

/** The portal's bulk-upload file. */
export function buildEwayJSON(f: EwayForm) {
  const totalValue = r2(f.items.reduce((s, i) => s + i.taxable, 0))
  const tax = f.items.reduce((s, i) => s + i.taxable * i.gstRate / 100, 0)
  const half = r2(tax / 2)
  // The biggest line by value decides the main HSN.
  const main = [...f.items].sort((a, b) => b.taxable - a.taxable)[0]
  const fromCode = stateCode(f.from.state, f.from.gstin), toCode = stateCode(f.to.state, f.to.gstin)
  return {
    version: '1.0.0621',
    billLists: [{
      userGstin: f.from.gstin,
      supplyType: 'O', subSupplyType: 1, subSupplyDesc: '', docType: 'INV',
      docNo: f.docNo, docDate: ddmmyyyy(f.docDate), transType: 1,
      fromGstin: f.from.gstin, fromTrdName: f.from.name, fromAddr1: f.from.addr1, fromAddr2: f.from.addr2,
      fromPlace: f.from.place, fromPincode: Number(f.from.pincode), fromStateCode: fromCode, actualFromStateCode: fromCode,
      toGstin: f.to.gstin || 'URP', toTrdName: f.to.name, toAddr1: f.to.addr1, toAddr2: f.to.addr2,
      toPlace: f.to.place, toPincode: Number(f.to.pincode), toStateCode: toCode, actualToStateCode: toCode,
      totalValue,
      cgstValue: f.igst ? 0 : half, sgstValue: f.igst ? 0 : half, igstValue: f.igst ? r2(tax) : 0,
      cessValue: 0, TotNonAdvolVal: 0, OthValue: r2(f.othValue), totInvValue: r2(f.totInvValue),
      transMode: Number(f.transMode), transDistance: String(Math.round(f.distanceKm)),
      transporterName: f.transporterName, transporterId: f.transporterId.toUpperCase(),
      transDocNo: f.transDocNo, transDocDate: ddmmyyyy(f.transDocDate),
      vehicleNo: f.vehicleNo.replace(/[\s-]/g, '').toUpperCase(), vehicleType: 'R',
      mainHsnCode: Number(main?.hsn || 0),
      itemList: f.items.map((it, i) => ({
        itemNo: i + 1, productName: it.name, productDesc: it.desc, hsnCode: Number(it.hsn),
        quantity: it.qty, qtyUnit: 'PCS', taxableAmount: r2(it.taxable),
        sgstRate: f.igst ? 0 : it.gstRate / 2, cgstRate: f.igst ? 0 : it.gstRate / 2, igstRate: f.igst ? it.gstRate : 0,
        cessRate: 0, cessNonAdvol: 0,
      })),
    }],
  }
}

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The same e-way bill on A4: Part A (supply) and Part B (transport). */
export function buildEwayHTML(f: EwayForm): string {
  const j = buildEwayJSON(f).billLists[0]
  const party = (title: string, x: EwayParty, code: number) => `
    <div class="box"><div class="lbl">${title}</div>
      <b>${esc(x.name)}</b><br>GSTIN: ${esc(x.gstin || 'URP (unregistered)')}<br>
      ${esc(x.addr1)}${x.addr2 ? ', ' + esc(x.addr2) : ''}<br>${esc(x.place)} – ${esc(x.pincode)}<br>${esc(x.state)} (${code})</div>`
  const rows = f.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}<div class="sub">${esc(it.desc)}</div></td>
    <td>${esc(it.hsn)}</td><td class="n">${it.qty} PCS</td><td class="n">${inr(it.taxable)}</td>
    <td class="n">${f.igst ? `IGST ${it.gstRate}%` : `CGST ${it.gstRate / 2}% + SGST ${it.gstRate / 2}%`}</td></tr>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>E-Way Bill ${esc(f.docNo)}</title><style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; } body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; }
  h1 { font-size: 18px; margin: 0; } .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 6px; }
  .note { font-size: 10px; color: #444; margin: 6px 0 10px; }
  .part { font-size: 12px; font-weight: 700; background: #eee; padding: 4px 6px; margin-top: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
  .box { border: 1px solid #000; padding: 6px 8px; line-height: 1.45; } .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #444; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; } th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; font-size: 10px; } .n { text-align: right; white-space: nowrap; } .sub { font-size: 9px; color: #444; }
  .kv { display: grid; grid-template-columns: 170px 1fr; gap: 2px 10px; margin-top: 6px; } .kv div:nth-child(odd) { color: #444; }
</style></head><body>
  <div class="head"><h1>E-Way Bill</h1><div>Document: <b>${esc(f.docNo)}</b> · ${esc(fmtDate(f.docDate))}</div></div>
  <div class="note">Prepared for upload to ewaybillgst.gov.in. The e-way bill number is issued by the portal; write it here: ____________________</div>

  <div class="part">PART A — Supply</div>
  <div class="kv">
    <div>Supply type</div><div>Outward · Supply · Tax Invoice (INV)</div>
    <div>Transaction type</div><div>Regular · ${f.igst ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}</div>
  </div>
  <div class="grid">${party('From (supplier)', f.from, j.fromStateCode)}${party('To (recipient)', f.to, j.toStateCode)}</div>
  <table><thead><tr><th>#</th><th>Product</th><th>HSN</th><th class="n">Qty</th><th class="n">Taxable value</th><th class="n">Tax rate</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <table><tbody>
    <tr><td>Taxable value</td><td class="n">${inr(j.totalValue)}</td><td>CGST</td><td class="n">${inr(j.cgstValue)}</td><td>SGST</td><td class="n">${inr(j.sgstValue)}</td></tr>
    <tr><td>IGST</td><td class="n">${inr(j.igstValue)}</td><td>Other (freight etc.)</td><td class="n">${inr(j.OthValue)}</td>
        <td><b>Invoice value</b></td><td class="n"><b>${inr(j.totInvValue)}</b></td></tr>
  </tbody></table>

  <div class="part">PART B — Transport</div>
  <div class="kv">
    <div>Mode</div><div>${esc(TRANS_MODES[f.transMode] || '')}</div>
    <div>Approx. distance</div><div>${f.distanceKm ? f.distanceKm + ' km' : 'by PIN codes (portal)'}</div>
    <div>Vehicle no.</div><div>${esc(j.vehicleNo || '—')}</div>
    <div>Transporter</div><div>${esc(f.transporterName || '—')}${f.transporterId ? ' · ID ' + esc(j.transporterId) : ''}</div>
    <div>Transport doc. no. / date</div><div>${esc(f.transDocNo || '—')}${f.transDocDate ? ' · ' + esc(fmtDate(f.transDocDate)) : ''}</div>
  </div>
</body></html>`
}

/** Hand the browser a file to save. */
export function downloadFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
