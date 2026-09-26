import { getSettings, type AppSettings } from './settings'
import type { LabelData } from './printLabels'

/**
 * Barcode labels as TSPL, the language a TSC printer actually speaks.
 *
 * WHY NOT HTML
 * A TTP-244 Pro has no page. Asking Chromium for a 77mm-wide sheet and letting
 * the TSC driver fit it to 38mm stock is what rotated every label 90 degrees,
 * drifted the content off the label and ate blank ones in between. TSPL states
 * the stock size, the gap and the position of every element in dots, and draws
 * the barcode in the printer's own firmware — crisper than a rendered SVG and
 * with nothing left for a driver to reinterpret.
 *
 * Everything here is driven by the shop's measured stock, because label rolls
 * vary and no default survives contact with real stationery.
 */

const DPI = 203                     // TTP-244 Pro
export const DOTS_PER_MM = DPI / 25.4   // ≈ 7.99

export const mm = (v: number) => Math.round(v * DOTS_PER_MM)

/** TSPL strings are quoted; a quote or backslash inside one ends it early. */
const q = (s: any) =>
  String(s == null ? '' : s)
    .replace(/[\\]/g, '')
    .replace(/"/g, "'")
    .replace(/[₹]/g, 'Rs.')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()

// Bitmap font cell widths in dots, before magnification. Used to centre text,
// which TSPL will not do for us.
const FONT_W: Record<string, number> = { '1': 8, '2': 12, '3': 16, '4': 24, '5': 32 }
const FONT_H: Record<string, number> = { '1': 12, '2': 20, '3': 24, '4': 32, '5': 48 }

const textW = (s: string, font: string, xmul: number) => s.length * FONT_W[font] * xmul

export interface LabelGeometry {
  widthMm: number        // one label
  heightMm: number
  columns: number        // labels across the web
  columnGapMm: number    // space between columns
  rowGapMm: number       // the gap the printer's sensor indexes on
  offsetXmm: number      // nudge everything, for stock that sits off-centre
  offsetYmm: number
  darkness: number       // 0-15
  speed: number          // ips
}

export function labelGeometry(s?: Partial<AppSettings>): LabelGeometry {
  const c = { ...getSettings(), ...(s || {}) }
  return {
    widthMm: Number(c.labelWidthMm) || 38,
    heightMm: Number(c.labelHeightMm) || 38,
    columns: Math.max(1, Math.min(4, Number(c.labelColumns) || 2)),
    columnGapMm: Number(c.labelColumnGapMm) || 2,
    rowGapMm: Number(c.labelRowGapMm) || 2,
    offsetXmm: Number(c.labelOffsetXmm) || 0,
    offsetYmm: Number(c.labelOffsetYmm) || 0,
    darkness: Math.max(0, Math.min(15, Number(c.labelDarkness ?? 8))),
    speed: Math.max(1, Math.min(6, Number(c.labelSpeed ?? 4))),
  }
}

/**
 * One label, laid out to match the shop's existing tag:
 *
 *      URMIII ALL PLUS          shop, centred
 *      SHORT MIDI               category
 *      4413        Maroon       design no / colour
 *      87             3XL       product code / size
 *          Rs.1850              price, large
 *        |||||||||||            CODE128
 *      45237        45237       the code, both sides
 *
 * Note on the rupee sign: TSPL bitmap fonts are ASCII, so the printer has no
 * glyph for it and prints "Rs." instead. Turn off direct label printing to get
 * the rendered version with the real symbol.
 */
function oneLabel(l: LabelData, x0: number, y0: number, g: LabelGeometry): string[] {
  const W = mm(g.widthMm)
  const pad = mm(2)
  const out: string[] = []

  const put = (x: number, y: number, font: string, xmul: number, ymul: number, t: string) => {
    const v = q(t)
    if (v) out.push(`TEXT ${x},${y0 + y},"${font}",0,${xmul},${ymul},"${v}"`)
  }
  const left = (t: string, y: number, f: string, xm = 1, ym = 1) => put(x0 + pad, y, f, xm, ym, t)
  const right = (t: string, y: number, f: string, xm = 1, ym = 1) => {
    const v = q(t)
    if (v) put(x0 + W - pad - textW(v, f, xm), y, f, xm, ym, v)
  }
  const centre = (t: string, y: number, f: string, xm = 1, ym = 1) => {
    const v = q(t)
    if (v) put(x0 + Math.max(pad, Math.round((W - textW(v, f, xm)) / 2)), y, f, xm, ym, v)
  }

  let y = mm(1.5)
  centre(l.shopName, y, '2'); y += FONT_H['2'] + 4
  left(l.productName || l.designNo, y, '2'); y += FONT_H['2'] + 4
  left(l.designNo, y, '1'); right(l.colour, y, '1'); y += FONT_H['1'] + 3
  left(l.pcode, y, '1'); right(l.size, y, '1'); y += FONT_H['1'] + 6

  centre('Rs.' + Math.round(Number(l.mrp) || 0), y, '4'); y += FONT_H['4'] + 6

  const code = q(l.barcode)
  if (code) {
    // narrow bar of n dots gives (11*chars + 35) * n dots of width
    const modules = 11 * code.length + 35
    const narrow = modules * 3 <= W - 2 * pad ? 3 : 2
    const bx = x0 + Math.max(pad, Math.round((W - modules * narrow) / 2))
    const bh = mm(7)
    // human-readable off: the shop's tag shows the code at both ends instead
    out.push(`BARCODE ${bx},${y0 + y},"128",${bh},0,0,${narrow},${narrow * 2},"${code}"`)
    y += bh + 4
    left(code, y, '1'); right(code, y, '1')
  }

  return out
}

/**
 * A complete TSPL program. One PRINT per row of labels, so the roll advances by
 * exactly one row — the drift that wasted a roll came from a page height that
 * had nothing to do with the stock.
 */
export function buildLabelTSPL(labels: LabelData[], geo?: LabelGeometry): string {
  const g = geo || labelGeometry()
  const webMm = g.columns * g.widthMm + (g.columns - 1) * g.columnGapMm
  const pitch = mm(g.widthMm + g.columnGapMm)
  const ox = mm(g.offsetXmm)
  const oy = mm(g.offsetYmm)

  const head = [
    `SIZE ${webMm.toFixed(1)} mm,${g.heightMm.toFixed(1)} mm`,
    `GAP ${g.rowGapMm.toFixed(1)} mm,0 mm`,
    'DIRECTION 1',
    'REFERENCE 0,0',
    `SPEED ${g.speed}`,
    `DENSITY ${g.darkness}`,
    'SET CUTTER OFF',
    'CLS',
  ]

  const body: string[] = []
  for (let i = 0; i < labels.length; i += g.columns) {
    if (i > 0) body.push('CLS')
    for (let c = 0; c < g.columns; c++) {
      const l = labels[i + c]
      if (!l) break                       // short last row: leave it blank, don't stretch
      body.push(...oneLabel(l, ox + c * pitch, oy, g))
    }
    body.push('PRINT 1,1')
  }

  return head.join('\n') + '\n' + body.join('\n') + '\n'
}
