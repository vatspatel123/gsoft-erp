#!/usr/bin/env node
// Look for bills that were saved on a PC but never reached the server and are no longer
// in the app's storage. Chromium keeps old values inside its storage files after they are
// "deleted", until it tidies them up — so a bill is often still readable there.
//
// Usage:   node find-lost-bills.js "<folder>"  [out.json]
// <folder> = the COPY of  %APPDATA%\gsoft-erp\Local Storage\leveldb  (also try %APPDATA%\Retail ERP\...)
// Do this on a COPY of the folder, with the app closed — opening the app again can tidy the old data away.
//
// Finds whole bills when it can ({"invoiceNo":...,"createdAt":...}); otherwise prints the
// pieces it can read (invoice no, customer, amounts, items) so a bill can be re-made by hand.

const fs = require('fs')
const path = require('path')

const dir = process.argv[2]
const out = process.argv[3] || 'recovered-bills.json'

// Everything printed is also saved (UTF-8) next to the output file, so a run on a Windows PC
// does not depend on how that console shows the rupee sign or wide text.
const report = out.replace(/\.json$/, '') + '-report.txt'
const printed = []
const origLog = console.log
console.log = (...a) => { printed.push(a.join(' ')); origLog(...a) }
process.on('exit', () => { try { fs.writeFileSync(report, '\ufeff' + printed.join('\n') + '\n', 'utf8') } catch { /* nowhere to write */ } })
if (!dir || !fs.existsSync(dir)) { console.error('Give the folder to search: node find-lost-bills.js "<leveldb folder>"'); process.exit(1) }

const files = fs.readdirSync(dir).filter(f => /\.(log|ldb|sst)$/i.test(f)).map(f => path.join(dir, f))
if (!files.length) { console.error('No .log / .ldb files in that folder'); process.exit(1) }

// Chromium stores a value as latin-1 (prefix 0x01) or UTF-16 (prefix 0x00): look at the file both ways.
const views = (buf) => [buf.toString('latin1'), buf.toString('utf16le'), buf.subarray(1).toString('utf16le')]

// ── reading Chromium's compressed table files (.ldb) properly ─────────────────────────────
// A .ldb file is blocks of key/value pairs, each block usually Snappy-compressed, found through an
// index at the end of the file. Reading them as plain text only shows the pieces that were not squashed.
function snappy(buf) {
  let pos = 0, len = 0, shift = 0
  for (;;) { const b = buf[pos++]; len |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7 }
  const out = Buffer.alloc(len); let o = 0
  while (pos < buf.length) {
    const tag = buf[pos++], type = tag & 3
    if (type === 0) {
      let l = tag >> 2
      if (l < 60) l += 1; else { const n = l - 59; l = 0; for (let i = 0; i < n; i++) l |= buf[pos++] << (8 * i); l += 1 }
      buf.copy(out, o, pos, pos + l); pos += l; o += l
    } else {
      let l, off
      if (type === 1) { l = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | buf[pos++] }
      else if (type === 2) { l = (tag >> 2) + 1; off = buf.readUInt16LE(pos); pos += 2 }
      else { l = (tag >> 2) + 1; off = buf.readUInt32LE(pos); pos += 4 }
      for (let i = 0; i < l; i++) { out[o] = out[o - off]; o++ }
    }
  }
  return out
}
function varint(b, pos) { let v = 0, m = 1; for (;;) { const x = b[pos++]; v += (x & 0x7f) * m; if (!(x & 0x80)) break; m *= 128 } return [v, pos] }
function block(file, off, size) {
  const raw = file.subarray(off, off + size + 5)
  const data = raw.subarray(0, size)
  return raw[size] === 1 ? snappy(data) : data
}
function* entries(b) {
  const restarts = b.readUInt32LE(b.length - 4), end = b.length - 4 - 4 * restarts
  let pos = 0, key = Buffer.alloc(0)
  while (pos < end) {
    let shared, nonShared, vlen
    ;[shared, pos] = varint(b, pos); [nonShared, pos] = varint(b, pos); [vlen, pos] = varint(b, pos)
    key = Buffer.concat([key.subarray(0, shared), b.subarray(pos, pos + nonShared)])
    yield { key, value: b.subarray(pos + nonShared, pos + nonShared + vlen) }
    pos += nonShared + vlen
  }
}
/** Every stored value whose key mentions `needle`, from one .ldb file. */
function* tableValues(file, needle) {
  const foot = file.subarray(file.length - 48)
  let p = 0, idxOff, idxSize
  ;[, p] = varint(foot, p); [, p] = varint(foot, p); [idxOff, p] = varint(foot, p); [idxSize, p] = varint(foot, p)
  for (const e of entries(block(file, idxOff, idxSize))) {
    let q = 0, off, size
    ;[off, q] = varint(e.value, q); [size, q] = varint(e.value, q)
    for (const kv of entries(block(file, off, size))) {
      if (kv.value.length && kv.key.toString('latin1').includes(needle)) yield kv.value
    }
  }
}
const decodeValue = (v) => (v[0] === 0 ? v.subarray(1).toString('utf16le') : v.subarray(1).toString('latin1'))
const addFromJson = (text, file) => {
  let arr
  try { arr = JSON.parse(text) } catch { return }
  for (const b of Array.isArray(arr) ? arr : []) {
    if (!b || !b.invoiceNo) continue
    const key = `${b.invoiceNo}|${b.pendingId}`
    if (!bills.has(key)) bills.set(key, { bill: b, file })
  }
}

const bills = new Map()
const fragments = []

// 1. the proper way: decompress the tables and read every stored version of the bill queue
for (const f of files.filter(f => /\.(ldb|sst)$/i.test(f))) {
  try {
    for (const v of tableValues(fs.readFileSync(f), 'gsoft_pending_sales')) addFromJson(decodeValue(v), path.basename(f))
  } catch (e) { console.error(`(could not read ${path.basename(f)} as a table: ${e.message}; falling back to a plain scan)`) }
}

const WHOLE = /\{"invoiceNo":"[^"]{3,40}"[\s\S]{0,60000}?"createdAt":"[^"]+"\}/g

for (const f of files) {
  const buf = fs.readFileSync(f)
  for (const text of views(buf)) {
    for (const m of text.matchAll(WHOLE)) {
      try {
        const b = JSON.parse(m[0])
        const key = `${b.invoiceNo}|${b.pendingId}`
        if (!bills.has(key)) bills.set(key, { bill: b, file: path.basename(f) })
      } catch { /* a piece of a bill, not a whole one */ }
    }
    // Pieces: anything that looks like a bill's header or its customer/amount fields.
    for (const m of text.matchAll(/"invoiceNo":"((?:INV-L|OFF-)[^"]{2,30})"/g)) {
      const around = text.slice(Math.max(0, m.index - 80), m.index + 1500).replace(/[^\x20-\x7e]/g, '·')
      fragments.push({ invoiceNo: m[1], file: path.basename(f), text: around })
    }
  }
}

// ── reading the screens' saved copies properly (IndexedDB values are V8-serialized objects) ──
// Tolerant reader: returns what it could decode, never throws.
function v8Decode(buf, start) {
  let pos = start
  const refs = []
  const rv = () => { let v = 0, m = 1; for (;;) { const x = buf[pos++]; v += (x & 0x7f) * m; if (!(x & 0x80)) break; m *= 128 } return v }
  const zig = () => { const n = rv(); return n % 2 ? -(n + 1) / 2 : n / 2 }
  function val() {
    let t = buf[pos++]
    while (t === 0) t = buf[pos++]                       // padding
    switch (String.fromCharCode(t)) {
      case '"': { const n = rv(); const x = buf.toString('latin1', pos, pos + n); pos += n; return x }
      case 'c': { const n = rv(); const x = buf.toString('utf16le', pos, pos + n); pos += n; return x }
      case 'S': { const n = rv(); const x = buf.toString('utf8', pos, pos + n); pos += n; return x }
      case 'I': return zig()
      case 'U': return rv()
      case 'N': { const x = buf.readDoubleLE(pos); pos += 8; return x }
      case 'T': return true
      case 'F': return false
      case '0': return null
      case '_': return undefined
      case 'D': { const x = buf.readDoubleLE(pos); pos += 8; return new Date(x).toISOString() }
      case 'o': { const o = {}; refs.push(o); for (;;) { if (buf[pos] === 0x7b) { pos++; rv(); return o } const k = val(); o[k] = val() } }
      case 'A': { const n = rv(); const a = new Array(n); refs.push(a); for (let i = 0; i < n; i++) a[i] = val(); if (buf[pos] === 0x24) { pos++; rv(); rv() } return a }
      case 'a': { const n = rv(); const a = []; refs.push(a); for (;;) { if (buf[pos] === 0x40) { pos++; rv(); rv(); return a } const k = val(); a[k] = val() } }
      case '^': return refs[rv()]
      default: throw new Error('unknown tag ' + t)
    }
  }
  try { return val() } catch { return undefined }
}
/** Walk any decoded value and call fn for every object that looks like a bill (invoice_no / invoiceNo). */
function walk(v, fn, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 8) return
  if (typeof (v.invoice_no || v.invoiceNo) === 'string') fn(v)
  for (const k of Object.keys(v)) walk(v[k], fn, depth + 1)
}
const idbBills = new Map()
const addBills = (root, file) => walk(root, b => {
  const no = b.invoice_no || b.invoiceNo
  if (/^(INV-L|OFF-)/.test(no) && !idbBills.has(no)) idbBills.set(no, { b, file })
})
// A stored value is [FF 11 02] + a Snappy block holding the real data when it is big, else the data itself.
const decodeStream = (buf, file) => {
  for (let i = 0; i < Math.min(buf.length - 2, 120); i++) {
    if (buf[i] === 0xff && buf[i + 1] >= 0x0d && buf[i + 1] <= 0x20 && buf[i + 2] === 0x6f) {
      const root = v8Decode(buf, i + 2)
      if (root) { addBills(root, file); return true }
    }
  }
  return false
}
const collectIdb = (value, file) => {
  if (decodeStream(value, file)) return
  for (let i = 0; i < Math.min(value.length - 3, 16); i++) {
    if (value[i] === 0xff && value[i + 1] >= 0x0d && value[i + 1] <= 0x20 && value[i + 2] === 0x02) {
      try { if (decodeStream(snappy(value.subarray(i + 3)), file)) return } catch { /* not compressed that way */ }
    }
  }
}
// Reassemble a leveldb write-ahead log (.log): 32 KB blocks of records that can split one value.
function* logEntries(buf) {
  let rec = [], batches = []
  for (let off = 0; off + 7 <= buf.length;) {
    const blockEnd = Math.min(buf.length, (Math.floor(off / 32768) + 1) * 32768)
    if (blockEnd - off < 7) { off = blockEnd; continue }
    const len = buf.readUInt16LE(off + 4), type = buf[off + 6]
    if (off + 7 + len > buf.length) break
    const part = buf.subarray(off + 7, off + 7 + len)
    if (type === 1) batches.push(part)
    else if (type === 2) rec = [part]
    else if (type === 3) rec.push(part)
    else if (type === 4) { rec.push(part); batches.push(Buffer.concat(rec)); rec = [] }
    off += 7 + len
  }
  for (const b of batches) {
    let pos = 12
    while (pos < b.length) {
      const t = b[pos++]
      let kl; [kl, pos] = varint(b, pos); const key = b.subarray(pos, pos + kl); pos += kl
      if (t === 1) { let vl; [vl, pos] = varint(b, pos); yield { key, value: b.subarray(pos, pos + vl) }; pos += vl }
    }
  }
}
for (const f of files) {
  try {
    const buf = fs.readFileSync(f)
    if (/\.log$/i.test(f)) { for (const kv of logEntries(buf)) collectIdb(kv.value, path.basename(f)) }
    else {
      const foot = buf.subarray(buf.length - 48)
      let p = 0, idxOff, idxSize
      ;[, p] = varint(foot, p); [, p] = varint(foot, p); [idxOff, p] = varint(foot, p); [idxSize, p] = varint(foot, p)
      for (const e of entries(block(buf, idxOff, idxSize))) {
        let q = 0, off, size
        ;[off, q] = varint(e.value, q); [size, q] = varint(e.value, q)
        for (const kv of entries(block(buf, off, size))) collectIdb(kv.value, path.basename(f))
      }
    }
  } catch { /* the plain scans cover files that are not readable as tables */ }
}

// 2. the screens' saved copies (the IndexedDB folder, since 1.0.32): the Invoices copy kept unsent bills
//    with their items. Not JSON there, so read every stored value as text and show what surrounds
//    each unsent-bill number (INV-L… / OFF-…): customer, items, quantities, amounts.
const copies = new Map()
const readable = (t) => t.replace(/[^\x20-\x7e]+/g, ' | ').replace(/( \| ){2,}/g, ' | ')
const scanText = (text, file) => {
  for (const m of text.matchAll(/(?:INV-L|OFF-)\d{5,}/g)) {
    if (copies.has(m[0])) continue
    copies.set(m[0], { file, text: readable(text.slice(Math.max(0, m.index - 250), m.index + 1400)) })
  }
}
for (const f of files) {
  try {
    const buf = fs.readFileSync(f)
    if (/\.log$/i.test(f)) { for (const t of views(buf)) scanText(t, path.basename(f)); continue }
    // a table: every value, decompressed
    const foot = buf.subarray(buf.length - 48)
    let p = 0, idxOff, idxSize
    ;[, p] = varint(foot, p); [, p] = varint(foot, p); [idxOff, p] = varint(foot, p); [idxSize, p] = varint(foot, p)
    for (const e of entries(block(buf, idxOff, idxSize))) {
      let q = 0, off, size
      ;[off, q] = varint(e.value, q); [size, q] = varint(e.value, q)
      for (const kv of entries(block(buf, off, size))) { for (const t of views(kv.value)) scanText(t, path.basename(f)) }
    }
  } catch { /* not a readable table: the plain scan above covers it */ }
}

const list = [...bills.values()]
console.log(`\nFiles searched: ${files.length}`)
console.log(`Whole bills found: ${list.length}\n`)
for (const { bill: b, file } of list) {
  const cust = b.customer ? `${b.customer.name} ${b.customer.phone}` : 'no customer'
  console.log(`• ${b.invoiceNo}  ${b.date || b.createdAt}  ${cust}  salesman ${b.salesmanName || b.salesmanId || '—'}  net ₹${b.netAmount}  paid ${JSON.stringify(b.tenders || b.paymentMode)}  [${file}]`)
  for (const i of b.cart || []) console.log(`     ${i.qty} × ${i.product?.name || '?'} ${i.product?.design_no || ''} ${i.product?.size || ''} ${i.product?.colour || ''}  barcode ${i.product?.barcode || ''}  @ ₹${i.unit_price}  = ₹${i.line_total}`)
}
if (list.length) { fs.writeFileSync(out, JSON.stringify(list.map(l => l.bill), null, 2)); console.log(`\nSaved the whole bills to ${out}`) }

const seen = new Set(list.map(l => l.bill.invoiceNo))
const loose = []
for (const fr of fragments) { if (!seen.has(fr.invoiceNo) && !loose.find(l => l.invoiceNo === fr.invoiceNo)) loose.push(fr) }
if (loose.length) {
  console.log(`\nBills found only in pieces (${loose.length}) — enough to re-make them by hand:`)
  for (const fr of loose) console.log(`\n• ${fr.invoiceNo}  [${fr.file}]\n  ${fr.text.slice(0, 900)}`)
}
if (idbBills.size) {
  console.log(`\nBills read from the screens' saved copies (${idbBills.size}):`)
  const out2 = []
  for (const [no, { b, file }] of idbBills) {
    const items = (b.sale_items || b.cart || []).map(i => ({ name: i.products?.name || i.product?.name, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total }))
    const cust = b.customers || b.customer || {}
    console.log(`• ${no}  ${b.created_at || b.date || ''}  ${cust.name || '—'} ${cust.phone || ''}  salesman ${b.users?.name || b.salesmanName || '—'}  net ₹${b.net_amount ?? b.netAmount}  ${b.payment_mode || b.paymentMode || ''}  [${file}]`)
    for (const i of items) console.log(`     ${i.qty} × ${i.name}  @ ₹${i.unitPrice}  = ₹${i.lineTotal}`)
    out2.push({ invoiceNo: no, createdAt: b.created_at || b.date, customer: cust, salesman: b.users?.name || b.salesmanName, net: b.net_amount ?? b.netAmount, paymentMode: b.payment_mode || b.paymentMode, items })
  }
  fs.writeFileSync(out.replace(/\.json$/, '') + '-from-screen-copies.json', JSON.stringify(out2, null, 2))
  console.log(`(also saved, readable: ${out.replace(/\.json$/, '')}-from-screen-copies.json — to re-make the bills by hand)`)
}

const wholeNos = new Set(list.map(l => l.bill.invoiceNo))
const fromCopies = [...copies.entries()].filter(([no]) => !wholeNos.has(no))
if (fromCopies.length) {
  console.log(`\nUnsent-bill numbers found in the screens' saved copies (${fromCopies.length}) — read the customer, items and amounts around each:`)
  for (const [no, c] of fromCopies) console.log(`\n• ${no}  [${c.file}]\n  ${c.text.slice(0, 1300)}`)
}
if (!list.length && !loose.length && !fromCopies.length) console.log('Nothing found. The old data has probably been tidied away; use the printed bills and Invoices to re-make them.')
