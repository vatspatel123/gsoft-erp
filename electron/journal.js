// A permanent, append-only record of every bill the till completes, written to disk by
// the desktop app: Documents/RetailERP-Backups/bill-journal/bills-YYYY-MM.jsonl
//
// Why: a bill that could not reach the server waits in the app's own storage on this PC,
// and that storage can be emptied (a button, a reinstall, a crash). This file cannot be
// emptied from inside the app, so a bill that was ever completed can always be found and
// rebuilt. One JSON line per event: { at, invoiceNo, status: saved | queued | synced, ... }.

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const pad = (n) => String(n).padStart(2, '0')
const dir = () => path.join(app.getPath('documents'), 'RetailERP-Backups', 'bill-journal')

function add(entry) {
  try {
    fs.mkdirSync(dir(), { recursive: true })
    const d = new Date()
    const file = path.join(dir(), `bills-${d.getFullYear()}-${pad(d.getMonth() + 1)}.jsonl`)
    fs.appendFileSync(file, JSON.stringify({ at: d.toISOString(), ...entry }) + '\n')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Could not write the bill journal' }
  }
}

module.exports = { add, dir }
