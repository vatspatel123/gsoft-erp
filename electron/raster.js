// Draw a document as a picture and send the dots straight to the printer.
//
// WHY
// Handing HTML to the Windows driver of a thermal receipt printer is what has
// printed blank paper on the shop's RP326 every time it has been tried: the
// driver has no real page, and a silent print lands on nothing. Plain ESC/POS
// text always printed, but can't carry a logo or real fonts.
//
// This does what POS software does for logos: the app renders the page itself
// at the printer's exact dot width, turns it into black-and-white dots, and
// sends those dots through the same RAW pipe that plain text already uses.
// The driver never lays anything out, so there is nothing left to go blank.
//
//   Receipts: ESC/POS "GS v 0" raster, in bands.
//   Labels:   TSPL "BITMAP" per label, placed in dots on the roll.

const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs = require('fs')

const DOTS_PER_MM = 203 / 25.4          // both printers are 203 dpi
const CSS_PX_PER_MM = 96 / 25.4

let win = null
let chain = Promise.resolve()           // one render at a time: they share a window
let seq = 0

function getWin() {
  if (win && !win.isDestroyed()) return win
  win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: 600,
    height: 400,
    backgroundColor: '#ffffff',
    // Offscreen, so a long bill is not clipped to the height of the monitor.
    webPreferences: { offscreen: true, backgroundThrottling: false, sandbox: false },
  })
  win.on('closed', () => { win = null })
  return win
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * The next frame the offscreen window paints at its current size, falling back
 * to a plain capture. A frame of the wrong shape is one painted before a resize
 * landed — accepting it cut a bill off at the window's old height.
 */
function freshFrame(w) {
  const [cw, ch] = w.getContentSize()
  const rightShape = (image) => {
    const { width, height } = image.getSize()
    return width > 0 && Math.abs(height / width - ch / cw) < 0.01
  }
  const painted = new Promise(resolve => {
    const onPaint = (_e, _dirty, image) => { if (!image.isEmpty() && rightShape(image)) { w.webContents.off('paint', onPaint); resolve(image) } }
    w.webContents.on('paint', onPaint)
    setTimeout(() => { w.webContents.off('paint', onPaint); resolve(null) }, 2000)
  })
  w.webContents.invalidate()
  return painted.then(img => img || w.webContents.capturePage())
}

/** Dots across a width, rounded to whole bytes as both command sets require. */
const dotsFor = (mm) => Math.max(8, Math.round(mm * DOTS_PER_MM / 8) * 8)

/**
 * Render HTML at exactly `widthMm` and return 1-bit rows, 1 = black.
 * The page is laid out in CSS millimetres and zoomed so that one CSS pixel
 * column lands on the printer's dot grid.
 */
function renderBits(html, opts) {
  const job = chain.then(() => doRender(html, opts), () => doRender(html, opts))
  chain = job.catch(() => {})
  return job
}

async function doRender(html, { widthMm, heightMm = 0, settleMs = 250, threshold = 170, mark = '' }) {
  const dots = dotsFor(widthMm)
  const zoom = dots / (widthMm * CSS_PX_PER_MM)

  // A plain white ground behind the document, or transparent edges read as black.
  const page = String(html).replace(/<head>/i,
    '<head><style>html,body{background:#fff!important}html{margin:0}</style>')

  const file = path.join(app.getPath('temp'), `erp-raster-${Date.now()}-${++seq}.html`)
  fs.writeFileSync(file, page, 'utf8')
  try {
    const w = getWin()
    w.setContentSize(dots, 400)
    await w.loadFile(file)
    w.webContents.setZoomFactor(zoom)
    await sleep(settleMs)             // logos decode and barcodes draw after load

    const cssH = heightMm > 0
      ? heightMm * CSS_PX_PER_MM
      : await w.webContents.executeJavaScript(
          'Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().height))')
    const pxH = Math.min(16000, Math.ceil(cssH * zoom))
    w.setContentSize(dots, pxH)
    await sleep(150)

    // Where a placeholder sits, in dots — the label leaves an empty box for the
    // printer to draw its own barcode into.
    const box = mark ? await w.webContents.executeJavaScript(
      `(() => { const e = document.querySelector(${JSON.stringify(mark)}); if (!e) return null;
                const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })()`)
      : null

    // A frame painted now, after this document loaded. A bare capturePage() can
    // hand back the last frame on screen — on a slow PC that was the previous
    // label, so its details printed over the next label's barcode.
    let img = await freshFrame(w)
    let { width, height } = img.getSize()
    if (!width || !height) throw new Error('Nothing was drawn to print')
    if (width !== dots) {
      img = img.resize({ width: dots, quality: 'best' })
      ;({ width, height } = img.getSize())
    }
    if (heightMm > 0) height = Math.min(height, Math.round(heightMm * DOTS_PER_MM))

    const bits = toBits(img.toBitmap(), width, height, threshold)
    if (box) bits.mark = { x: Math.round(box.x * zoom), y: Math.round(box.y * zoom),
                           w: Math.round(box.w * zoom), h: Math.round(box.h * zoom) }
    return bits
  } finally {
    fs.promises.unlink(file).catch(() => {})
  }
}

/**
 * BGRA pixels to packed 1-bit rows. Transparent pixels count as white paper.
 * Trailing blank rows are dropped so the roll doesn't feed past the bill.
 */
function toBits(bgra, width, height, threshold) {
  const bpr = width / 8
  const out = Buffer.alloc(bpr * height)
  let lastInk = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = bgra[i + 3]
      const lum = 0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]
      const onWhite = (lum * a + 255 * (255 - a)) / 255
      if (onWhite < threshold) {
        out[y * bpr + (x >> 3)] |= 0x80 >> (x & 7)
        lastInk = y
      }
    }
  }
  const h = Math.max(1, lastInk + 1)
  return { width, height: h, fullHeight: height, data: out.subarray(0, bpr * h) }
}

/** ESC/POS job: initialise, raster in bands, feed past the tear bar, cut. */
function escposRaster(bits) {
  const bpr = bits.width / 8
  const parts = [Buffer.from([0x1b, 0x40])]
  // 256-row bands: small enough for any printer's buffer, and bands butt up
  // against each other with no gap.
  const BAND = 256
  for (let y = 0; y < bits.height; y += BAND) {
    const h = Math.min(BAND, bits.height - y)
    parts.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, h & 0xff, h >> 8]))
    parts.push(bits.data.subarray(y * bpr, (y + h) * bpr))
  }
  parts.push(Buffer.from([0x1b, 0x64, 0x04]))           // feed 4 lines
  parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]))     // partial cut
  return Buffer.concat(parts)
}

/** TSPL wants 0 for a printed dot — the opposite of ESC/POS. */
function tsplBitmap(x, y, bits) {
  const bpr = bits.width / 8
  const inverted = Buffer.from(bits.data)
  for (let i = 0; i < inverted.length; i++) inverted[i] ^= 0xff
  return Buffer.concat([
    Buffer.from(`BITMAP ${x},${y},${bpr},${bits.height},0,`, 'latin1'),
    inverted,
    Buffer.from('\r\n', 'latin1'),
  ])
}

/**
 * CODE128 drawn by the printer's own firmware, centred in the box the label
 * left for it. A barcode scaled as a picture lands on a fractional dot grid and
 * its bars come out uneven — the firmware draws every bar a whole number of
 * dots wide, which is what a scanner needs.
 */
function nativeBarcode(x0, y0, box, code) {
  const safe = String(code).replace(/[^\x20-\x7e]/g, '').replace(/"/g, '')
  // Module count: digit runs pack two per symbol (code set C).
  const modules = /^\d+$/.test(safe)
    ? 11 * Math.ceil(safe.length / 2) + 46
    : 11 * safe.length + 35
  const narrow = [4, 3, 2, 1].find(n => modules * n <= box.w) || 1
  const x = x0 + box.x + Math.max(0, Math.floor((box.w - modules * narrow) / 2))
  return `BARCODE ${x},${y0 + box.y},"128",${Math.max(24, box.h)},0,0,${narrow},${narrow},"${safe}"`
}

/** A receipt, drawn as a picture. */
async function billJob(html, widthMm) {
  return escposRaster(await renderBits(html, { widthMm }))
}

/**
 * A label run: one BITMAP per label, placed column by column, one PRINT per
 * row of the roll so it advances exactly one row at a time.
 */
async function labelJob(labelHtmls, g) {
  const cache = new Map()
  const inked = (b) => b.data.some(x => x)
  const bitsFor = async (html) => {
    if (!cache.has(html)) {
      const opts = { widthMm: g.widthMm, heightMm: g.heightMm, settleMs: 350, mark: '#bc' }
      let bits = await renderBits(html, opts)
      // A label always has text on it. Blank means the page wasn't drawn in
      // time: try once more, slower, rather than print a barcode-only sticker.
      if (!inked(bits)) bits = await renderBits(html, { ...opts, settleMs: 1200 })
      if (!inked(bits)) throw new Error('A label came out blank twice — nothing was printed. Please try again.')
      cache.set(html, bits)
    }
    return cache.get(html)
  }

  const webMm = g.columns * g.widthMm + (g.columns - 1) * g.columnGapMm
  const mm = (v) => Math.round(v * DOTS_PER_MM)
  const pitch = mm(g.widthMm + g.columnGapMm)
  const ox = Math.max(0, mm(g.offsetXmm || 0))
  const oy = Math.max(0, mm(g.offsetYmm || 0))

  const parts = [Buffer.from([
    `SIZE ${webMm.toFixed(1)} mm,${Number(g.heightMm).toFixed(1)} mm`,
    `GAP ${Number(g.rowGapMm).toFixed(1)} mm,0 mm`,
    'DIRECTION 1',
    'REFERENCE 0,0',
    `SPEED ${g.speed}`,
    `DENSITY ${g.darkness}`,
    'SET CUTTER OFF',
    '',
  ].join('\r\n'), 'latin1')]

  for (let i = 0; i < labelHtmls.length; i += g.columns) {
    parts.push(Buffer.from('CLS\r\n', 'latin1'))
    for (let c = 0; c < g.columns && i + c < labelHtmls.length; c++) {
      const html = labelHtmls[i + c]
      const bits = await bitsFor(html)
      const x = ox + c * pitch
      parts.push(tsplBitmap(x, oy, bits))
      const code = (/data-code="([^"]*)"/.exec(html) || [])[1]
      if (code && bits.mark) parts.push(Buffer.from(nativeBarcode(x, oy, bits.mark, code) + '\r\n', 'latin1'))
    }
    parts.push(Buffer.from('PRINT 1,1\r\n', 'latin1'))
  }
  return Buffer.concat(parts)
}

module.exports = { renderBits, escposRaster, tsplBitmap, billJob, labelJob, dotsFor }
