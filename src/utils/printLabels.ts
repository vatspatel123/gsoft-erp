// The barcode library is bundled, not fetched from a CDN at print time: a shop
// with no internet would otherwise print labels with an empty space where the
// barcode should be, and nothing would say why.
import JSBARCODE_SRC from 'jsbarcode/dist/JsBarcode.all.min.js?raw'

import { printHTML, printRawText, useRawLabels, printRasterLabels } from './printHTML'
import toast from 'react-hot-toast'
import { buildLabelTSPL, labelGeometry } from './tsplLabels'
import { getSettings } from './settings'
import { activeLabelDesign, buildDesignedLabelHTML } from './formatDesigns'
export interface LabelData {
  shopName: string
  category: string
  productName: string
  designNo: string
  colour: string
  pcode: string
  size: string
  mrp: number
  price?: number
  barcode: string
  batchNo: string
}

export function printBarcodeLabels(
  products: any[],
  copies: number = 1,
  format: '38x38' | '50x25' | '50x30' | '58mm' = '58mm'
) {
  const settings = JSON.parse(localStorage.getItem('erp_settings') || '{}')
  const shopName = settings.shopName || 'Retail ERP'

  const labels: LabelData[] = []

  products.forEach(product => {
    for (let c = 0; c < copies; c++) {
      labels.push({
        shopName,
        // The tag's second line is the category ("SHORT MIDI"). In this shop
        // product.name holds the design number, so it can't stand in for it.
        category: product.category || product.categories?.name || product.name || '',
        productName: product.name || '',
        designNo: product.design_no || '',
        colour: product.colour || '',
        pcode: product.pcode || '',
        size: product.size || '',
        mrp: product.mrp || product.unit_price || 0,
        price: product.unit_price || 0,
        barcode: product.barcode || product.batch_no || product.sku || '',
        batchNo: product.batch_no || product.sku || ''
      })
    }
  })

  const is58mm = format === '58mm'
  const labelsPerRow = is58mm ? 1 : 2

  const labelIds = labels.map((_, idx) => 'bc' + idx)

  const renderLabel = (label: LabelData, id: string) => `
    <div class="label">
      <div class="shop-name">${label.shopName}</div>
      <div class="product-name">${label.productName}</div>
      <div class="detail-row">
        <span>${label.designNo}</span>
        <span>${label.colour}</span>
      </div>
      <div class="detail-row">
        <span>${label.pcode}</span>
        <span class="size-text">${label.size}</span>
      </div>
      <div class="mrp-row">
        <span class="rupee">&#x20B9;</span>
        <span class="mrp-price">${label.mrp.toFixed(0)}</span>
      </div>
      <svg class="barcode-svg" id="${id}"></svg>
      <div class="batch-row">
        <span>${label.batchNo}</span>
        <span>${label.batchNo}</span>
      </div>
    </div>
  `

  // Build rows
  let rowsHtml = ''
  let labelIdx = 0

  if (is58mm) {
    // Single column for 58mm
    rowsHtml = labels.map((label, i) => {
      const id = labelIds[i]
      return `<div class="label-row">${renderLabel(label, id)}</div>`
    }).join('')
  } else {
    // Paired columns for other formats
    const rows: Array<{ left: LabelData; right: LabelData | null }> = []
    for (let i = 0; i < labels.length; i += 2) {
      rows.push({ left: labels[i], right: labels[i + 1] || null })
    }
    rowsHtml = rows.map(row => {
      const leftId = labelIds[labelIdx++]
      const rightId = row.right ? labelIds[labelIdx++] : null
      return `
        <div class="label-pair">
          ${renderLabel(row.left, leftId)}
          ${row.right && rightId ? renderLabel(row.right, rightId) : '<div class="label"></div>'}
        </div>
      `
    }).join('')
  }

  // Stationery size in mm. `size` needs TWO lengths — "105mm auto" is invalid
  // CSS and is dropped silently, which sent one label onto a full sheet of
  // paper and left it sitting in the bottom-left corner.
  const labelWmm = is58mm ? 58 : format === '38x38' ? 38 : 50
  const labelHmm = is58mm ? 32 : format === '38x38' ? 38 : format === '50x25' ? 25 : 30
  const gapMm = is58mm ? 0 : 1
  // one printed page = one ROW of labels, so printing a single label advances
  // the roll by one row instead of ejecting a whole sheet
  const pageWmm = is58mm ? labelWmm : labelsPerRow * labelWmm + (labelsPerRow - 1) * gapMm
  const pageHmm = labelHmm

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Barcode Labels</title>
  <script>${typeof JSBARCODE_SRC === 'string' && JSBARCODE_SRC.length > 1000
    ? JSBARCODE_SRC
    : ''}</script>
  ${typeof JSBARCODE_SRC === 'string' && JSBARCODE_SRC.length > 1000
    ? ''
    : '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>'}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: white; }
    /* No outer padding: labels must start hard against the top-left corner or
       they drift onto the next label position on the roll. */
    .page { display: flex; flex-wrap: wrap; padding: 0; gap: 0; ${is58mm ? 'flex-direction: column; align-items: center;' : ''} }
    .label-row { margin: 0; }
    .label-pair { display: flex; gap: ${gapMm}mm; margin: 0; }
    .label {
      width: ${labelWmm}mm;
      height: ${labelHmm}mm;
      border: ${is58mm ? 'none' : '0.5px solid #ccc'};
      padding: ${is58mm ? '3px 6px' : '2px 3px'};
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
      background: white;
    }
    .shop-name { font-size: ${is58mm ? '8px' : '7px'}; font-weight: 700; text-align: center; letter-spacing: 0.3px; width: 100%; white-space: nowrap; overflow: hidden; }
    .product-name { font-size: ${is58mm ? '10px' : '8px'}; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; width: 100%; }
    .detail-row { display: flex; justify-content: space-between; width: 100%; font-size: ${is58mm ? '8px' : '6.5px'}; color: #333; padding: 0 1px; }
    .size-text { font-weight: 600; }
    .mrp-row { display: flex; align-items: baseline; gap: 1px; margin: 1px 0; }
    .rupee { font-size: ${is58mm ? '11px' : '9px'}; font-weight: 600; }
    .mrp-price { font-size: ${is58mm ? '22px' : '18px'}; font-weight: 700; line-height: 1; }
    .barcode-svg { width: ${is58mm ? '190px' : '130px'}; height: ${is58mm ? '32px' : '30px'}; }
    .batch-row { display: flex; justify-content: space-between; width: 100%; font-size: 6px; color: #555; padding: 0 2px; }
    @media print {
      body { margin: 0; padding: 0; }
      /* Width and height are injected at print time from the measured content,
         so this only clears the margin. */
      @page { margin: 0; }
      .label { border: none !important; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${rowsHtml}
  </div>
  <script>
    var labelsData = ${JSON.stringify(labels)};
    window.onload = function() {
      document.querySelectorAll('.barcode-svg').forEach(function(svg, idx) {
        var label = labelsData[idx];
        if (!label || !label.barcode) return;
        try {
          JsBarcode(svg, label.barcode, {
            format: 'CODE128',
            width: ${is58mm ? '1.5' : '1'},
            height: ${is58mm ? '30' : '28'},
            displayValue: false,
            margin: 0,
            background: 'transparent',
            lineColor: '#000'
          });
        } catch(e) {
          console.error('Barcode error:', e);
        }
      });
    };
  </script>
</body>
</html>`

  // A TSC printer speaks TSPL. Rendering HTML and letting its driver fit a
  // 77mm sheet onto 38mm stock is what rotated every label 90 degrees, drifted
  // the content off the roll and ate blank labels — see tsplLabels.ts.
  // HTML stays as the fallback if the raw write fails.
  const htmlFallback = () =>
    printHTML(html, { target: 'label', widthMm: pageWmm, heightMm: pageHmm, settleMs: 700 })

  // Designed labels drawn as dots — the real rupee sign, the shop's layout —
  // placed on the roll by TSPL. Plain TSPL text is the fallback.
  if (useRawLabels() && window.electronAPI?.printing?.rasterLabels) {
    const geo = labelGeometry()
    printRasterLabels(labels.map(l => buildLabelHTML(l, geo.widthMm, geo.heightMm)), geo).then(res => {
      if (res.ok) return
      toast.error(`Label printer: ${res.reason || 'failed'} — printing plain labels`)
      printRawText('label', buildLabelTSPL(labels))
    })
    return
  }

  if (useRawLabels()) {
    printRawText('label', buildLabelTSPL(labels)).then(res => {
      if (res.ok) return
      toast.error(`Label printer: ${res.reason || 'failed'} — using the print dialog`)
      htmlFallback()
    })
    return
  }

  // Longer settle so JsBarcode has drawn every SVG before printing.
  htmlFallback()
}


const escLabel = (v: any) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * One label as a standalone page, laid out like the shop's existing tag:
 *
 *   URMIII ALL PLUS
 *   SHORT MIDI
 *   4413        PrimaryCOLOUR
 *   87                   3XL
 *   ₹ 1850
 *   ||||||||||||||||||||||
 *   45237           45237
 *
 * Drawn to dots by the desktop app (electron/raster.js), so the fonts and the
 * rupee sign come out exactly as they look here.
 */
export function buildLabelHTML(l: LabelData, widthMm = 38, heightMm = 38): string {
  // The shop's own format from the designer, when one is active.
  const design = activeLabelDesign(getSettings())
  if (design) return buildDesignedLabelHTML(design, l, widthMm, heightMm)
  const code = String(l.barcode || '')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  /* Centred throughout, as the shop asked. The top margin is a touch deeper
     than the sides: a sticker that sits slightly high on the roll otherwise
     loses the shop name off its top edge. */
  body { width:${widthMm}mm; height:${heightMm}mm; overflow:hidden; background:#fff; color:#000;
         font-family: Arial, Helvetica, sans-serif; padding: 3mm 2.4mm 1.4mm; text-align:center; }
  .shop { font-size:12px; font-weight:800; letter-spacing:.3px; white-space:nowrap; overflow:hidden; }
  .cat  { font-size:11px; font-weight:700; margin-top:1px; white-space:nowrap; overflow:hidden; }
  .row  { display:flex; justify-content:center; gap:6mm; font-size:9.5px; font-weight:700;
          margin-top:2px; white-space:nowrap; }
  .row:empty, .row span:empty { display:none; }
  .mrp  { display:flex; justify-content:center; align-items:baseline; gap:4px; margin-top:2px; }
  .mrp .r { font-size:13px; font-weight:700; }
  .mrp .v { font-size:25px; font-weight:800; line-height:1; letter-spacing:.3px; }
  #bc { width:100%; height:8.2mm; margin-top:1.5px; }   /* the printer draws the barcode here */
  .codes { display:flex; justify-content:space-between; font-size:9.5px; font-weight:700; margin-top:1px; }
</style></head><body>
  <div class="shop">${escLabel(l.shopName)}</div>
  <div class="cat">${escLabel(l.category)}</div>
  <div class="row"><span>${escLabel(l.designNo)}</span><span>${escLabel(l.colour)}</span></div>
  <div class="row"><span>${escLabel(l.pcode)}</span><span>${escLabel(l.size)}</span></div>
  <div class="mrp"><span class="r">&#x20B9;</span><span class="v">${Math.round(Number(l.mrp) || 0)}</span></div>
  <div id="bc" data-code="${escLabel(code)}"></div>
  <div class="codes"><span>${escLabel(code)}</span><span>${escLabel(code)}</span></div>
</body></html>`
}
