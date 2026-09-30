// Shop-designed formats for the barcode label and the sales bill.
//
// Formats are part of the shop settings, so they sync to every counter. Until
// one is made active (index -1) the built-in layouts print exactly as before, so
// a shop that never opens the designer sees no change.
import type { AppSettings } from './settings'

// ─── Label ──────────────────────────────────────────────────────────────────

export type LabelField =
  | 'shopName' | 'category' | 'designNo' | 'pcode' | 'size' | 'colour'
  | 'mrp' | 'price' | 'barcodeText' | 'batch'

export const LABEL_FIELDS: Record<LabelField, string> = {
  shopName: 'Shop name', category: 'Category', designNo: 'Design no', pcode: 'P.Code',
  size: 'Size', colour: 'Colour', mrp: 'MRP', price: 'Selling price',
  barcodeText: 'Barcode no.', batch: 'Batch',
}

/** One item on the label. Every position and size is in millimetres. */
export type LabelEl =
  | { t: 'field'; f: LabelField; x: number; y: number; w: number; h: number; pt: number; bold: boolean; align: Align; pre: string }
  | { t: 'text'; text: string; x: number; y: number; w: number; h: number; pt: number; bold: boolean; align: Align }
  | { t: 'barcode'; x: number; y: number; w: number; h: number }
  | { t: 'line'; x: number; y: number; w: number; h: number }
export type Align = 'left' | 'center' | 'right'

export interface LabelDesign { name: string; w: number; h: number; els: LabelEl[] }

/** The values a label is filled from — see printLabels.ts. */
export interface LabelValues {
  shopName: string; category: string; designNo: string; pcode: string; size: string
  colour: string; mrp: number; price?: number; barcode: string; batchNo: string
}

/** The built-in label, redrawn as a design so the shop can start from it. */
export function defaultLabelDesign(w = 38, h = 38): LabelDesign {
  const cw = w - 4
  return { name: 'Standard label', w, h, els: [
    { t: 'field', f: 'shopName', x: 2, y: 2.5, w: cw, h: 4.5, pt: 9, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'category', x: 2, y: 7, w: cw, h: 4, pt: 8, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'designNo', x: 2, y: 11, w: cw / 2, h: 3.5, pt: 7, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'colour', x: 2 + cw / 2, y: 11, w: cw / 2, h: 3.5, pt: 7, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'pcode', x: 2, y: 14.5, w: cw / 2, h: 3.5, pt: 7, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'size', x: 2 + cw / 2, y: 14.5, w: cw / 2, h: 3.5, pt: 7, bold: true, align: 'center', pre: '' },
    { t: 'field', f: 'mrp', x: 2, y: 18.5, w: cw, h: 7, pt: 18, bold: true, align: 'center', pre: '₹ ' },
    { t: 'barcode', x: 2.4, y: 26, w: w - 4.8, h: 7.5 },
    { t: 'field', f: 'barcodeText', x: 2, y: 33.5, w: cw, h: 3.5, pt: 7, bold: true, align: 'center', pre: '' },
  ]}
}

export function labelFieldText(el: LabelEl, v: LabelValues): string {
  if (el.t === 'text') return el.text
  if (el.t !== 'field') return ''
  const raw: Record<LabelField, string> = {
    shopName: v.shopName, category: v.category, designNo: v.designNo, pcode: v.pcode,
    size: v.size, colour: v.colour,
    mrp: v.mrp ? String(Math.round(Number(v.mrp))) : '',
    price: v.price ? String(Math.round(Number(v.price))) : '',
    barcodeText: v.barcode, batch: v.batchNo,
  }
  const val = raw[el.f] || ''
  return val ? (el.pre || '') + val : ''
}

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const PT_TO_MM = 0.3528

/**
 * A designed label as a page the size of the label stock. The barcode element is
 * left as an empty box (#bc) that the printer fills with its own firmware
 * barcode — see electron/raster.js — so the bars stay sharp.
 */
export function buildDesignedLabelHTML(d: LabelDesign, v: LabelValues, widthMm: number, heightMm: number): string {
  let barcodeDone = false
  const els = d.els.map(el => {
    const box = `left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;`
    if (el.t === 'barcode') {
      if (barcodeDone) return ''             // the printer draws one barcode per label
      barcodeDone = true
      return `<div id="bc" data-code="${esc(v.barcode)}" style="position:absolute;${box}"></div>`
    }
    if (el.t === 'line') return `<div style="position:absolute;${box}background:#000"></div>`
    const just = el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center'
    return `<div style="position:absolute;${box}display:flex;align-items:center;justify-content:${just};` +
      `font-size:${el.pt}pt;font-weight:${el.bold ? 800 : 500};white-space:nowrap;overflow:hidden;line-height:1.1">` +
      `${esc(labelFieldText(el, v))}</div>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { position:relative; width:${widthMm}mm; height:${heightMm}mm; overflow:hidden; background:#fff; color:#000;
         font-family: Arial, Helvetica, sans-serif; }
</style></head><body>${els}</body></html>`
}

// ─── Bill ───────────────────────────────────────────────────────────────────

export type BillColKey = 'no' | 'category' | 'barcode' | 'design' | 'size' | 'colour' | 'qty' | 'rate' | 'disc' | 'hsn' | 'amount'
export interface BillCol { k: BillColKey; label: string; on: boolean; w: number }

export interface BillDesign {
  name: string
  showLogo: boolean; showShopName: boolean; shopNameSize: number
  showTagline: boolean; showAddress: boolean; showPhone: boolean; showGstin: boolean
  showCustomer: boolean; billNoLabel: string; dateLabel: string
  cols: BillCol[]
  showTotalRow: boolean; showDiscount: boolean; showGst: boolean; showRound: boolean
  netLabel: string; netSize: number
  showSalesman: boolean; showTerms: boolean; showTime: boolean; showPayment: boolean; showFooter: boolean
}

export const BILL_COL_NAMES: Record<BillColKey, string> = {
  no: 'Serial no.', category: 'Category', barcode: 'Barcode', design: 'Design no', size: 'Size',
  colour: 'Colour', qty: 'Qty', rate: 'Rate', disc: 'Discount %', hsn: 'HSN', amount: 'Amount',
}

/** Today's bill, expressed as a design. Built from the shop's existing settings. */
export function defaultBillDesign(s: Pick<AppSettings, 'shopLogo' | 'showGSTIN' | 'showCustomer' | 'showSalesman' | 'showPaymentBreakdown'>): BillDesign {
  return {
    name: 'Standard bill',
    showLogo: true, showShopName: !s.shopLogo, shopNameSize: 19,
    showTagline: true, showAddress: true, showPhone: true, showGstin: !!s.showGSTIN,
    showCustomer: !!s.showCustomer, billNoLabel: 'Bill No.:', dateLabel: 'Bill Date.:',
    cols: [
      { k: 'no', label: 'No.', on: true, w: 6 },
      { k: 'category', label: 'Category', on: true, w: 20 },
      { k: 'barcode', label: 'Barcode', on: true, w: 15 },
      { k: 'design', label: 'Design', on: false, w: 12 },
      { k: 'colour', label: 'Colour', on: false, w: 12 },
      { k: 'size', label: 'Size', on: true, w: 12 },
      { k: 'qty', label: 'Qty', on: true, w: 7 },
      { k: 'rate', label: 'Rate', on: true, w: 17 },
      { k: 'disc', label: 'Disc%', on: false, w: 8 },
      { k: 'hsn', label: 'HSN', on: false, w: 10 },
      { k: 'amount', label: 'Amount', on: true, w: 23 },
    ],
    showTotalRow: true, showDiscount: true, showGst: false, showRound: false,
    netLabel: 'Net Amt.: ₹', netSize: 16,
    showSalesman: !!s.showSalesman, showTerms: true, showTime: true,
    showPayment: !!s.showPaymentBreakdown, showFooter: true,
  }
}

/** The design the next bill prints with. */
export function activeBillDesign(s: AppSettings): BillDesign {
  const d = s.activeBillDesign >= 0 ? s.billDesigns?.[s.activeBillDesign] : null
  // A design saved by an older version may lack newer fields: fill them in.
  return d ? { ...defaultBillDesign(s), ...d } : defaultBillDesign(s)
}

export function activeLabelDesign(s: AppSettings): LabelDesign | null {
  return s.activeLabelDesign >= 0 ? s.labelDesigns?.[s.activeLabelDesign] || null : null
}
