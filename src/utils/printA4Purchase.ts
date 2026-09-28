import { getSettings } from './settings'
import { printHTML } from './printHTML'
import { rupeesInWords } from './numberWords'

/**
 * Purchase bills and purchase-return debit memos on A4, in the GST layout the
 * shop's accountant already works with (supplied as PurcReturnBill.PDF): a
 * ruled box, HSN per line, taxable value, CGST and SGST split into their own
 * columns, the amount in words, round off and grand total.
 *
 * This replaces a receipt-shaped document that was being sent to the 80mm
 * thermal printer despite its button saying "(A4)".
 */

export interface A4Line {
  name: string
  hsn?: string
  qty: number
  rate: number
  gstPct?: number        // 5 means 5%, split evenly into CGST and SGST
}

export interface A4PurchaseDoc {
  kind: 'purchase' | 'return'
  docNo?: string
  date: string | Date
  supplierName: string
  supplierGstin?: string
  placeOfSupply?: string
  origBillNo?: string
  origDate?: string
  items: A4Line[]
}

const esc = (v: any) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const n2 = (v: any) =>
  Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dmy = (d: string | Date | undefined) => {
  if (!d) return ''
  const t = new Date(d)
  return isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-GB').replace(/\//g, '/')
}

/** Minimum ruled rows, so a one-line bill still fills the page like theirs. */
const MIN_ROWS = 12

export function buildPurchaseA4HTML(doc: A4PurchaseDoc): string {
  const s = getSettings()

  const rows = doc.items.map((it, i) => {
    const taxable = Number(it.qty || 0) * Number(it.rate || 0)
    const pct = Number(it.gstPct ?? 0)
    // CGST and SGST each carry half the rate on an intra-state supply.
    const half = +(taxable * pct / 200).toFixed(2)
    return { i: i + 1, ...it, taxable, pct, cgst: half, sgst: half, net: +(taxable + half * 2).toFixed(2) }
  })

  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'net') =>
    rows.reduce((a, r) => a + Number(r[k] || 0), 0)

  const netTotal = sum('net')
  // Round Off is rounding to the rupee and nothing else, so it can never exceed
  // 50 paise. Forcing the total to a stored figure once pushed a whole ₹42.50 of
  // GST into this line on a purchase return.
  const grand = Math.round(netTotal)
  const roundOff = +(grand - netTotal).toFixed(2)
  const totalGST = sum('cgst') + sum('sgst')

  const title = doc.kind === 'return' ? 'PURC. RETURN' : 'PURCHASE BILL'
  const memo = doc.kind === 'return' ? 'Debit Memo' : 'Purchase Bill'

  const body = rows.map(r => `
    <tr>
      <td class="c">${r.i}</td>
      <td>${esc(r.name)}</td>
      <td class="c">${esc(r.hsn || '')}</td>
      <td class="r">${Number(r.qty).toFixed(3)}</td>
      <td class="r">${n2(r.rate)}</td>
      <td class="r">${n2(r.taxable)}</td>
      <td class="c">${r.pct ? r.pct.toFixed(1) : ''}</td>
      <td class="r">${r.cgst ? n2(r.cgst) : ''}</td>
      <td class="r">${r.sgst ? n2(r.sgst) : ''}</td>
      <td class="r">${n2(r.net)}</td>
    </tr>`).join('')

  const filler = Array.from(
    { length: Math.max(0, MIN_ROWS - rows.length) },
    () => '<tr class="pad"><td colspan="10">&nbsp;</td></tr>'
  ).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${esc(title)} ${esc(doc.docNo || '')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color:#000; background:#fff;
         width: 210mm; padding: 8mm; }
  .box { border: 1.2px solid #000; }
  .hd { text-align:center; padding: 6px 8px; border-bottom: 1.2px solid #000; }
  .hd .nm { font-size: 20pt; font-weight: bold; letter-spacing: .5px; }
  .hd .ad { font-size: 9.5pt; margin-top: 2px; }
  .strip { display:flex; border-bottom: 1.2px solid #000; font-weight:bold; font-size:10pt; }
  .strip > div { padding: 3px 8px; }
  .strip .l { width: 28%; }
  .strip .m { flex:1; text-align:center; }
  .strip .r { width: 28%; text-align:right; }
  .party { display:flex; border-bottom: 1.2px solid #000; }
  .party .who { flex:1; padding: 6px 8px; border-right: 1.2px solid #000; min-height: 22mm; }
  .party .who b { font-size: 12pt; }
  .party .inv { width: 46%; padding: 6px 8px; font-size: 10pt; }
  .party .inv div { display:flex; }
  .party .inv span:first-child { width: 34mm; font-weight: bold; }
  table { width:100%; border-collapse: collapse; font-size: 9.5pt; }
  th { border-bottom: 1.2px solid #000; border-right: 1px solid #000; padding: 3px 4px;
       font-size: 8.5pt; font-weight: bold; text-align:center; vertical-align: middle; }
  td { border-right: 1px solid #000; padding: 3px 4px; vertical-align: top; }
  th:last-child, td:last-child { border-right: 0; }
  tr.pad td { border-right:0; }
  .c { text-align:center; } .r { text-align:right; }
  .tot td { border-top: 1.2px solid #000; border-bottom: 1.2px solid #000;
            font-weight:bold; padding: 4px; }
  .foot { display:flex; border-bottom: 1.2px solid #000; }
  .foot .words { flex:1; padding: 5px 8px; font-size: 9.5pt; border-right: 1.2px solid #000; }
  .foot .words i { font-style: italic; }
  .foot .amt { width: 46%; }
  .foot .amt div { display:flex; justify-content:space-between; padding: 4px 8px; }
  .foot .amt .g { border-top: 1.2px solid #000; font-weight: bold; font-size: 12pt; }
  .terms { display:flex; }
  .terms .t { flex:1; padding: 5px 8px; font-size: 8.5pt; }
  .terms .sig { width: 46%; padding: 5px 8px; text-align:right; font-size: 9.5pt; }
  .terms .sig .s { margin-top: 14mm; font-size: 8.5pt; }
</style></head>
<body>
  <div class="box">
    <div class="hd">
      <div class="nm">${esc(s.shopName || 'Retail ERP')}</div>
      ${s.shopAddress ? `<div class="ad">${esc(s.shopAddress)}</div>` : ''}
      ${s.shopPhone ? `<div class="ad">M. ${esc(s.shopPhone)}</div>` : ''}
    </div>

    <div class="strip">
      <div class="l">${esc(memo)}</div>
      <div class="m">${esc(title)}</div>
      <div class="r">Original</div>
    </div>

    <div class="party">
      <div class="who">
        <div><b>M/s. : ${esc(doc.supplierName)}</b></div>
        ${doc.supplierGstin ? `<div style="font-size:9.5pt;margin-top:3px">GSTIN: ${esc(doc.supplierGstin)}</div>` : ''}
        <div style="margin-top:8mm;font-size:9.5pt">
          <b>Place of Supply :</b> ${esc(doc.placeOfSupply || s.state ? `24-${s.state || 'Gujarat'}` : '')}
        </div>
      </div>
      <div class="inv">
        <div><span>Invoice No.</span><span>: ${esc(doc.docNo || '')}</span></div>
        <div><span>Date</span><span>: ${dmy(doc.date)}</span></div>
        <div><span>Orig. Bill No.</span><span>: ${esc(doc.origBillNo || '')}</span></div>
        <div><span>Date</span><span>: ${dmy(doc.origDate) || '/  /'}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:7mm">Sr.</th>
          <th>Product Name</th>
          <th style="width:16mm">HSN/SAC<br>Code</th>
          <th style="width:16mm">Qty</th>
          <th style="width:20mm">Rate</th>
          <th style="width:22mm">Taxable<br>Amount</th>
          <th style="width:12mm">GST<br>%</th>
          <th style="width:20mm">Central</th>
          <th style="width:20mm">State/UT</th>
          <th style="width:24mm">Net<br>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${body}
        ${filler}
        <tr class="tot">
          <td colspan="2">GSTIN No.: ${esc(s.gstin || '')}</td>
          <td colspan="3" class="c">Total</td>
          <td class="r">${n2(sum('taxable'))}</td>
          <td></td>
          <td class="r">${n2(sum('cgst'))}</td>
          <td class="r">${n2(sum('sgst'))}</td>
          <td class="r">${n2(netTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="foot">
      <div class="words">
        <div><b>Total GST :</b> <i>${esc(rupeesInWords(totalGST))}</i></div>
        <div style="margin-top:5px"><b>Bill Amount :</b> <i>${esc(rupeesInWords(grand))}</i></div>
      </div>
      <div class="amt">
        <div><span>Round Off</span><span>${roundOff >= 0 ? '' : '-'}${n2(Math.abs(roundOff))}</span></div>
        <div class="g"><span>Grand Total</span><span>${n2(grand)}</span></div>
      </div>
    </div>

    <div class="terms">
      <div class="t">
        <b>Terms &amp; Condition :</b>
        <div><i>1. "Subject to '${esc((s.city || 'SURAT').toUpperCase())}' Jurisdiction only. E.&amp;.O.E"</i></div>
      </div>
      <div class="sig">
        For, ${esc(s.shopName || 'Retail ERP')}
        <div class="s">(Authorised Signatory)</div>
      </div>
    </div>
  </div>
</body></html>`
}

/** Print it on the A4 printer, or through the dialog when none is chosen. */
export function printPurchaseA4(doc: A4PurchaseDoc): void {
  printHTML(buildPurchaseA4HTML(doc), { target: 'a4', widthMm: 210, heightMm: 297, settleMs: 200 })
}
