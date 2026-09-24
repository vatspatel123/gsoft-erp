// WhatsApp relay for Retail ERP.
//
// Holds one linked-device WhatsApp session per store, so the POS running in a
// browser can send messages without any desktop app. The shop scans a QR once;
// the session lives here and survives restarts (see DATA_DIR below).
//
// Auth: every request must carry the caller's Supabase access token. We verify it
// with Supabase and resolve the caller's store through RLS, so this service never
// needs a service_role key and one store can never touch another's session.

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode')

const {
  ALLOWED_ORIGINS = '',
  DATA_DIR = path.join(__dirname, 'sessions'),
  PORT = 8080,
} = process.env

// The VITE_* fallbacks let `npm run relay` reuse the app's own .env.local
// locally. In production set SUPABASE_URL / SUPABASE_ANON_KEY properly.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required')
  process.exit(1)
}

fs.mkdirSync(DATA_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '2mb' }))   // bill HTML for the PDF, not just short text

// Chrome's Private Network Access. The hosted app runs on a public HTTPS origin
// while this relay listens on a private address (localhost / the shop's LAN).
// Chrome blocks public -> private requests outright unless the private server
// opts in on the preflight, which is why the hosted site could not reach it.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  next()
})

app.use(cors({
  origin: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',').map(s => s.trim()) : true,
  credentials: false,
}))

// ─── auth ────────────────────────────────────────────────────────────────────

// Status is polled every couple of seconds while the QR is on screen, so cache
// the token -> store lookup briefly instead of hitting Supabase each time.
const authCache = new Map()
const AUTH_TTL = 60_000

async function resolveStore(token) {
  const hit = authCache.get(token)
  if (hit && hit.expires > Date.now()) return hit.value

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers })
  if (!userRes.ok) return null
  const user = await userRes.json()

  // RLS scopes this to the caller's own store. Ordered so that an account which
  // ever owns more than one store keeps resolving to the same session directory
  // instead of re-pairing at random after a restart.
  const storeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?select=id&order=created_at.asc&limit=1`, { headers })
  if (!storeRes.ok) return null
  const rows = await storeRes.json()
  const storeId = Array.isArray(rows) && rows[0]?.id
  if (!storeId) return null

  const value = { userId: user.id, storeId: String(storeId) }
  authCache.set(token, { value, expires: Date.now() + AUTH_TTL })
  return value
}

const requireAuth = async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  try {
    const ctx = await resolveStore(token)
    if (!ctx) return res.status(403).json({ error: 'No store for this account' })
    req.ctx = ctx
    next()
  } catch (e) {
    res.status(500).json({ error: 'Auth check failed' })
  }
}

// ─── rate limit ──────────────────────────────────────────────────────────────

// WhatsApp bans numbers that behave like bots. This cap is deliberately low: a
// shop sends a handful of bills a minute, a runaway loop sends hundreds.
// ponytail: in-memory per process; move to Redis only if this ever runs multi-instance.
const RATE = { perMinute: 20, perDay: 500 }
const buckets = new Map()

function allowSend(storeId) {
  const now = Date.now()
  const b = buckets.get(storeId) || { minute: [], day: [] }
  b.minute = b.minute.filter(t => now - t < 60_000)
  b.day = b.day.filter(t => now - t < 86_400_000)
  if (b.minute.length >= RATE.perMinute) return 'Too many messages this minute — slow down'
  if (b.day.length >= RATE.perDay) return 'Daily message limit reached'
  b.minute.push(now); b.day.push(now)
  buckets.set(storeId, b)
  return null
}

// ─── whatsapp sessions ───────────────────────────────────────────────────────

const sessions = new Map()   // storeId -> { sock, status, qr, me, name, stopping }

const getSession = (storeId) => {
  if (!sessions.has(storeId)) {
    sessions.set(storeId, { sock: null, status: 'disconnected', qr: null, me: null, name: null, stopping: false })
  }
  return sessions.get(storeId)
}

const authDirFor = (storeId) => path.join(DATA_DIR, storeId.replace(/[^a-zA-Z0-9_-]/g, ''))

async function connect(storeId, { reset = false } = {}) {
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
    require('@whiskeysockets/baileys')

  const s = getSession(storeId)
  const authDir = authDirFor(storeId)

  if (reset) {
    try { await s.sock?.logout() } catch {}
    s.sock = null
    fs.rmSync(authDir, { recursive: true, force: true })
  }
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  s.stopping = false
  s.status = 'connecting'

  const sock = makeWASocket({
    version,
    auth: state,
    syncFullHistory: false,
    markOnlineOnConnect: false,   // don't steal "online" from the shop's phone
    logger: require('pino')({ level: 'silent' }),
  })
  s.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      s.qr = await QRCode.toDataURL(qr, { margin: 1, width: 280 })
      s.status = 'qr'
    }

    if (connection === 'open') {
      s.qr = null
      s.status = 'connected'
      s.me = sock.user?.id || null
      s.name = sock.user?.name || null
      console.log(`[${storeId}] connected as ${s.name || s.me}`)
    }

    if (connection === 'close') {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut
      if (loggedOut || s.stopping) {
        s.sock = null; s.status = 'disconnected'; s.qr = null; s.me = null; s.name = null
        if (loggedOut) fs.rmSync(authDir, { recursive: true, force: true })
        console.log(`[${storeId}] disconnected (${loggedOut ? 'logged out' : 'stopped'})`)
      } else {
        s.status = 'connecting'
        console.log(`[${storeId}] dropped, reconnecting`)
        setTimeout(() => connect(storeId).catch(() => { s.status = 'disconnected' }), 3000)
      }
    }
  })

  return { status: s.status }
}

const toJid = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return (digits.length === 10 ? '91' + digits : digits) + '@s.whatsapp.net'
}

// ─── routes ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, sessions: sessions.size }))

app.get('/status', requireAuth, (req, res) => {
  const s = getSession(req.ctx.storeId)
  res.json({ status: s.status, qr: s.qr, me: s.me, name: s.name })
})

app.post('/connect', requireAuth, async (req, res) => {
  try {
    await connect(req.ctx.storeId, { reset: !!req.body?.reset })
    const s = getSession(req.ctx.storeId)
    res.json({ status: s.status })
  } catch (e) {
    console.error('connect failed', e)
    res.status(500).json({ error: e.message || 'Could not start WhatsApp' })
  }
})

app.post('/send', requireAuth, async (req, res) => {
  const { storeId } = req.ctx
  const { phone, text } = req.body || {}
  const s = getSession(storeId)

  if (s.status !== 'connected' || !s.sock) return res.status(409).json({ error: 'WhatsApp is not connected' })
  if (!phone || !text) return res.status(400).json({ error: 'phone and text are required' })

  const limited = allowSend(storeId)
  if (limited) return res.status(429).json({ error: limited })

  const jid = toJid(phone)
  if (!jid) return res.status(400).json({ error: 'Invalid phone number' })

  try {
    const [found] = await s.sock.onWhatsApp(jid)
    if (!found?.exists) return res.status(404).json({ error: 'This number is not on WhatsApp' })
    const sent = await s.sock.sendMessage(found.jid, { text })
    res.json({ ok: true, id: sent?.key?.id || null })
  } catch (e) {
    console.error('send failed', e)
    res.status(500).json({ error: e.message || 'Send failed' })
  }
})

const { htmlToPdf } = require('./pdf')

app.post('/send-document', requireAuth, async (req, res) => {
  const { storeId } = req.ctx
  const { phone, html, caption = '', fileName = 'Invoice.pdf', widthMm = 80 } = req.body || {}
  const s = getSession(storeId)

  if (s.status !== 'connected' || !s.sock) return res.status(409).json({ error: 'WhatsApp is not connected' })
  if (!phone || !html) return res.status(400).json({ error: 'phone and html are required' })

  const limited = allowSend(storeId)
  if (limited) return res.status(429).json({ error: limited })

  const jid = toJid(phone)
  if (!jid) return res.status(400).json({ error: 'Invalid phone number' })

  try {
    const [found] = await s.sock.onWhatsApp(jid)
    if (!found?.exists) return res.status(404).json({ error: 'This number is not on WhatsApp' })

    const pdf = await htmlToPdf(html, widthMm)
    const sent = await s.sock.sendMessage(found.jid, {
      document: Buffer.from(pdf),
      mimetype: 'application/pdf',
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      caption,
    })
    res.json({ ok: true, id: sent?.key?.id || null, bytes: pdf.length })
  } catch (e) {
    console.error('send-document failed', e)
    res.status(500).json({ error: e.message || 'Could not send the bill' })
  }
})

app.post('/logout', requireAuth, async (req, res) => {
  const s = getSession(req.ctx.storeId)
  s.stopping = true
  try { await s.sock?.logout() } catch {}
  s.sock = null; s.status = 'disconnected'; s.qr = null; s.me = null; s.name = null
  fs.rmSync(authDirFor(req.ctx.storeId), { recursive: true, force: true })
  res.json({ ok: true })
})

// Restore sessions paired before the last restart, so a redeploy does not force
// the shop to scan the QR again. Requires DATA_DIR to be on a persistent disk.
function restoreSessions() {
  let dirs = []
  try { dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true }).filter(d => d.isDirectory()) } catch { return }
  for (const d of dirs) {
    if (!fs.existsSync(path.join(DATA_DIR, d.name, 'creds.json'))) continue
    console.log(`restoring session for store ${d.name}`)
    connect(d.name).catch(e => console.error(`restore failed for ${d.name}:`, e.message))
  }
}

app.listen(PORT, () => {
  console.log(`WhatsApp relay listening on :${PORT}`)
  console.log(`sessions stored in ${DATA_DIR}`)
  restoreSessions()
})
