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
  format: '38x38' | '50x25' | '50x30' = '38x38'
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

  const labelWidth = format === '38x38' ? 144 : 189
  const labelHeight = format === '38x38' ? 144 : format === '50x25' ? 94 : 113

  const rows: Array<{ left: LabelData; right: LabelData | null }> = []
  for (let i = 0; i < labels.length; i += 2) {
    rows.push({ left: labels[i], right: labels[i + 1] || null })
  }

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

  let labelIdx = 0
  const rowsHtml = rows.map(row => {
    const leftId = labelIds[labelIdx++]
    const rightId = row.right ? labelIds[labelIdx++] : null
    return `
      <div class="label-pair">
        ${renderLabel(row.left, leftId)}
        ${row.right && rightId ? renderLabel(row.right, rightId) : '<div class="label"></div>'}
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Barcode Labels</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: white; }
    .page { display: flex; flex-wrap: wrap; padding: 2mm; gap: 1mm; }
    .label-pair { display: flex; gap: 1mm; margin-bottom: 1mm; }
    .label {
      width: ${labelWidth}px;
      height: ${labelHeight}px;
      border: 0.5px solid #ccc;
      padding: 2px 3px;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
      background: white;
    }
    .shop-name { font-size: 7px; font-weight: 700; text-align: center; letter-spacing: 0.3px; width: 100%; white-space: nowrap; overflow: hidden; }
    .product-name { font-size: 8px; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; width: 100%; }
    .detail-row { display: flex; justify-content: space-between; width: 100%; font-size: 6.5px; color: #333; padding: 0 1px; }
    .size-text { font-weight: 600; }
    .mrp-row { display: flex; align-items: baseline; gap: 1px; margin: 1px 0; }
    .rupee { font-size: 9px; font-weight: 600; }
    .mrp-price { font-size: 18px; font-weight: 700; line-height: 1; }
    .barcode-svg { width: 130px; height: 30px; }
    .batch-row { display: flex; justify-content: space-between; width: 100%; font-size: 6px; color: #555; padding: 0 2px; }
    @media print {
      body { margin: 0; }
      @page { margin: 2mm; size: ${format === '38x38' ? '78mm auto' : '105mm auto'}; }
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
            width: 1,
            height: 28,
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

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
