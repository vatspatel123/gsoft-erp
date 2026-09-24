// HTML -> PDF for the WhatsApp bill attachment.
//
// Run `node pdf.js` to self-check that rendering works on this machine
// (including Gujarati text, emoji and the rupee sign, which are the parts that
// silently turn into blank boxes when fonts are missing on a server).

const fs = require('fs')
const path = require('path')

// One browser for the whole process, launched on first use so the service still
// starts (and sends text) on a host where Chromium is unavailable.
let browserPromise = null

const isAlive = (b) => !!b && (typeof b.connected === 'boolean' ? b.connected : b.isConnected?.())

const getBrowser = async () => {
  const puppeteer = require('puppeteer')

  // A cached browser can die under us (crash, OOM, the machine sleeping). Reusing
  // a dead one fails every later request with "Connection closed" until the
  // service is restarted, so check it is still alive before handing it back.
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null)
    if (isAlive(existing)) return existing
    browserPromise = null
  }

  browserPromise = puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  browserPromise.catch(() => { browserPromise = null })

  const browser = await browserPromise
  browser.once('disconnected', () => { browserPromise = null })
  return browser
}

// Errors that mean "the browser went away", as opposed to a bad page.
const isDeadBrowser = (e) =>
  /Connection closed|Target closed|Protocol error|Session closed|browser has disconnected/i
    .test(String(e?.message || ''))

/**
 * The HTML arrives from the client, so treat it as hostile: no JavaScript, and
 * every network request blocked. The bill template is fully self-contained
 * (inline CSS, no images or webfonts), so this costs nothing visually but
 * removes the SSRF / local-file-read surface that rendering HTML normally opens.
 */
async function renderOnce(html, widthMm) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', r => {
      // data: URIs are inline bytes, not network access — the shop logo is one.
      const allowed = r.url().startsWith('data:') ||
        (r.isNavigationRequest() && r.frame() === page.mainFrame())
      allowed ? r.continue() : r.abort()
    })
    // Receipt width at 96dpi, following the shop's paper-size setting.
    const mmToPx = (mm) => (mm / 25.4) * 96
    const safeWidth = Math.min(300, Math.max(40, Number(widthMm) || 80))
    const widthPx = Math.round(mmToPx(safeWidth))
    const vMarginPx = Math.round(mmToPx(4))

    // Short viewport on purpose: Page.getLayoutMetrics floors contentSize at the
    // viewport size, so a tall one would report its own height back to us and
    // every bill would come out padded to a full sheet.
    await page.setViewport({ width: widthPx, height: 50 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Trim the page to the bill's actual length instead of padding it out to a
    // full sheet. Measured over CDP rather than page.evaluate, because scripts
    // are disabled in this page and must stay that way.
    const client = await page.createCDPSession()
    const { contentSize } = await client.send('Page.getLayoutMetrics')

    // Puppeteer counts the margins inside `height`, so they have to be added on
    // top of the content or the last lines spill onto a second page.
    const heightPx = Math.ceil(contentSize.height) + vMarginPx * 2 + 4

    return await page.pdf({
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      printBackground: true,
      margin: { top: `${vMarginPx}px`, bottom: `${vMarginPx}px`, left: '0px', right: '0px' },
    })
  } finally {
    await page.close().catch(() => {})
  }
}

/**
 * Render the bill, surviving a browser that died between requests: the first
 * attempt is what discovers the corpse, so drop it and try once with a fresh one.
 */
async function htmlToPdf(html, widthMm = 80) {
  try {
    return await renderOnce(html, widthMm)
  } catch (e) {
    if (!isDeadBrowser(e)) throw e
    console.warn('pdf: browser had died, relaunching and retrying once')
    await closeBrowser()
    return await renderOnce(html, widthMm)
  }
}

const closeBrowser = async () => {
  if (!browserPromise) return
  const b = await browserPromise.catch(() => null)
  browserPromise = null
  await b?.close().catch(() => {})
}

module.exports = { htmlToPdf, closeBrowser }

// ─── self-check ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const assert = require('assert')

  const sample = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body
      style="font-family:'DM Sans',Arial,sans-serif;max-width:80mm;padding:20px">
    <h1 style="color:#9333ea;font-size:18px">Urmii All Plus</h1>
    <div>INVOICE: INV-TEST-001</div>
    <table style="width:100%"><tr><td>Kurti (XL | Red)</td><td style="text-align:right">₹1,299.00</td></tr></table>
    <div style="font-weight:700">Net Payable: ₹1,299.00</div>
    <div style="background:#fef2f2;padding:6px">⚠️ ઉધાર ખરીદી (CREDIT BILL)</div>
    <div>Thank you for shopping! 🛍️</div>
  </body></html>`

  ;(async () => {
    const pdf = await htmlToPdf(sample)
    const head = Buffer.from(pdf.slice(0, 5)).toString('latin1')

    assert.strictEqual(head, '%PDF-', `expected a PDF, got ${JSON.stringify(head)}`)
    assert.ok(pdf.length > 1000, `PDF suspiciously small: ${pdf.length} bytes`)

    // A page that failed to render fonts still produces a valid PDF, so also
    // check that embedded font data is present.
    const body = Buffer.from(pdf).toString('latin1')
    assert.ok(/FontFile|FontDescriptor/.test(body), 'no embedded font — text would render as boxes')

    // The receipt is trimmed to its own height. If that arithmetic is wrong the
    // bill silently loses its last lines onto a second page, which is exactly
    // the bug a "valid PDF" check sails straight past.
    const pages = (body.match(/\/Type\s*\/Page[^s]/g) || []).length
    assert.strictEqual(pages, 1, `expected a single trimmed page, got ${pages} — content is being clipped`)

    const out = path.join(require('os').tmpdir(), 'bill-selfcheck.pdf')
    fs.writeFileSync(out, pdf)

    console.log(`PASS: ${pdf.length} bytes, fonts embedded`)
    console.log(`wrote ${out} — open it to eyeball the Gujarati and emoji`)

    // The relay is long-running, so the browser WILL die at some point. Kill it
    // the way the OS would and confirm the next bill still sends, rather than
    // every later send failing with "Connection closed" until a restart.
    const victim = await getBrowser()
    victim.process()?.kill('SIGKILL')
    await new Promise(r => setTimeout(r, 500))

    const after = await htmlToPdf(sample)
    assert.strictEqual(Buffer.from(after.slice(0, 5)).toString('latin1'), '%PDF-',
      'did not recover after the browser was killed')
    console.log(`PASS: recovered after browser kill (${after.length} bytes)`)

    await closeBrowser()
  })().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
}
