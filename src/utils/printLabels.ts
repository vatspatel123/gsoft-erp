// The barcode library is bundled, not fetched from a CDN at print time: a shop
// with no internet would otherwise print labels with an empty space where the
// barcode should be, and nothing would say why.
import JSBARCODE_SRC from 'jsbarcode/dist/JsBarcode.all.min.js?raw'

import { printHTML } from './printHTML'
export interface LabelData {
  shopName: string
  productName: string
  designNo: string
  colour: string
  pcode: string
  size: string
  mrp: number
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
        productName: product.name || '',
        designNo: product.design_no || '',
        colour: product.colour || '',
        pcode: product.pcode || '',
        size: product.size || '',
        mrp: product.mrp || product.unit_price || 0,
        barcode: product.barcode || product.batch_no || product.sku || '',
        batchNo: product.batch_no || product.sku || ''
      })
    }
  })

  const is58mm = format === '58mm'

  // Dimensions based on format
  const labelWidth = is58mm ? 200 : format === '38x38' ? 144 : 189
  const labelHeight = is58mm ? 120 : format === '38x38' ? 144 : format === '50x25' ? 94 : 113
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
      setTimeout(function() { window.print(); }, 800);
    };
  </script>
</body>
</html>`

  // Longer settle so JsBarcode has drawn every SVG before printing.
  printHTML(html, { target: 'label', widthMm: pageWmm, settleMs: 700 })
}
