// Local backups: one compressed file of the shop's data, saved on this PC.
//
// The screen collects the data (it holds the login) and hands it here; this side
// writes it, checks the file reads back, and keeps the newest KEEP files.
// Restoring: gunzip the file — it is plain JSON { meta, tables: { name: [rows] } }.

const { app, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { promisify } = require('util')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)
const KEEP = 30           // about two weeks of twice-a-day backups

const dir = () => path.join(app.getPath('documents'), 'RetailERP-Backups')
const isBackup = (f) => /^backup-.*\.json\.gz$/.test(f)

function files() {
  try {
    return fs.readdirSync(dir()).filter(isBackup).map(name => {
      const st = fs.statSync(path.join(dir(), name))
      return { name, size: st.size, at: st.mtimeMs }
    }).sort((a, b) => b.at - a.at)
  } catch { return [] }
}

const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`

async function write({ tables, meta }) {
  if (!tables || !Object.keys(tables).length) return { ok: false, reason: 'Nothing to back up' }
  fs.mkdirSync(dir(), { recursive: true })
  const name = `backup-${stamp(new Date())}.json.gz`
  const final = path.join(dir(), name)
  const tmp = final + '.tmp'
  try {
    const counts = Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]))
    const body = JSON.stringify({ meta: { ...meta, appVersion: app.getVersion(), counts }, tables })
    fs.writeFileSync(tmp, await gzip(body))
    // A backup that cannot be read back is worse than none: check before keeping it.
    const back = JSON.parse((await gunzip(fs.readFileSync(tmp))).toString())
    for (const [t, n] of Object.entries(counts)) {
      if (!Array.isArray(back.tables[t]) || back.tables[t].length !== n) throw new Error(`Check failed on ${t}`)
    }
    fs.renameSync(tmp, final)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* nothing half-written left behind */ }
    return { ok: false, reason: (e && e.message) || 'Could not write the backup' }
  }
  for (const old of files().slice(KEEP)) { try { fs.unlinkSync(path.join(dir(), old.name)) } catch { /* in use: next time */ } }
  return { ok: true, name, path: final, size: fs.statSync(final).size }
}

const list = () => ({ dir: dir(), files: files().slice(0, 8) })
const open = async () => { fs.mkdirSync(dir(), { recursive: true }); return shell.openPath(dir()) }

module.exports = { write, list, open }
