// WhatsApp inside the desktop app.
//
// The session lives in this process, so the shop does NOT need any separate
// service running. Scan the QR once on the shop PC and bills send from there.
//
// IMPORTANT: this drives the shop's OWN WhatsApp account as a linked device.
// It is not the official Cloud API, and automated sending is against WhatsApp's
// terms — keep it to bills and reminders customers expect, never bulk marketing.

const path = require('path')
const fs = require('fs')

let sock = null
let status = 'disconnected'      // disconnected | connecting | qr | connected
let lastQr = null
let me = null
let meName = null
let stopping = false
let starting = false
let win = null

const send = (payload) => {
  if (win && !win.isDestroyed()) win.webContents.send('whatsapp:status', payload)
}
const setStatus = (s, extra = {}) => {
  status = s
  send({ status, qr: lastQr, me, name: meName, ...extra })
}

function authDir() {
  const { app } = require('electron')
  return path.join(app.getPath('userData'), 'wa-session')
}

function getStatus() {
  return { status, qr: lastQr, me, name: meName }
}

async function connect(mainWindow, { reset = false } = {}) {
  win = mainWindow || win
  if (starting) return getStatus()
  starting = true

  try {
    const QRCode = require('qrcode')
    const {
      default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
    } = require('@whiskeysockets/baileys')

    const dir = authDir()
    if (reset && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const { version } = await fetchLatestBaileysVersion()

    stopping = false
    setStatus('connecting')

    sock = makeWASocket({
      version,
      auth: state,
      syncFullHistory: false,
      markOnlineOnConnect: false,          // don't steal "online" from the shop's phone
      logger: require('pino')({ level: 'silent' }),
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        lastQr = await QRCode.toDataURL(qr, { margin: 1, width: 280 })
        setStatus('qr')
      }
      if (connection === 'open') {
        lastQr = null
        me = sock?.user?.id || null
        meName = sock?.user?.name || null
        setStatus('connected')
      }
      if (connection === 'close') {
        const loggedOut =
          lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut
        if (loggedOut || stopping) {
          sock = null; lastQr = null; me = null; meName = null
          if (loggedOut) { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }
          setStatus('disconnected', { reason: loggedOut ? 'logged_out' : 'stopped' })
        } else {
          setStatus('connecting', { reason: 'reconnecting' })
          setTimeout(() => { starting = false; connect(win).catch(() => setStatus('disconnected')) }, 3000)
        }
      }
    })
  } catch (e) {
    setStatus('disconnected', { reason: (e && e.message) || 'Could not start WhatsApp' })
  } finally {
    starting = false
  }
  return getStatus()
}

const toJid = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return (digits.length === 10 ? '91' + digits : digits) + '@s.whatsapp.net'
}

// Right after the app opens, or after a network blip, a paired session is still
// reconnecting. Wait for it instead of failing the send (which used to throw the
// cashier out to a browser tab).
async function ready(ms = 20000) {
  if (sock && status === 'connected') return true
  let paired = false
  try { paired = fs.existsSync(path.join(authDir(), 'creds.json')) } catch {}
  if (!paired) return false
  if (status === 'disconnected') connect(win).catch(() => {})
  const until = Date.now() + ms
  while (Date.now() < until) {
    await new Promise(r => setTimeout(r, 500))
    if (sock && status === 'connected') return true
    if (status === 'qr') return false        // pairing was lost: needs a fresh scan
  }
  return false
}

async function sendMessage(phone, text) {
  if (!(await ready())) return { ok: false, error: 'WhatsApp is not linked yet' }
  const jid = toJid(phone)
  if (!jid) return { ok: false, error: 'Invalid phone number' }
  try {
    const [found] = await sock.onWhatsApp(jid)
    if (!found?.exists) return { ok: false, error: 'This number is not on WhatsApp' }
    const res = await sock.sendMessage(found.jid, { text })
    return { ok: true, id: res?.key?.id || null }
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'Send failed' }
  }
}

async function sendDocument(phone, { pdfBase64, fileName, caption }) {
  if (!(await ready())) return { ok: false, error: 'WhatsApp is not linked yet' }
  const jid = toJid(phone)
  if (!jid) return { ok: false, error: 'Invalid phone number' }
  try {
    const [found] = await sock.onWhatsApp(jid)
    if (!found?.exists) return { ok: false, error: 'This number is not on WhatsApp' }
    const res = await sock.sendMessage(found.jid, {
      document: Buffer.from(pdfBase64, 'base64'),
      mimetype: 'application/pdf',
      fileName: String(fileName || 'Invoice.pdf').endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      caption: caption || '',
    })
    return { ok: true, id: res?.key?.id || null }
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'Send failed' }
  }
}

async function logout() {
  stopping = true
  try { await sock?.logout() } catch {}
  sock = null; lastQr = null; me = null; meName = null
  try { fs.rmSync(authDir(), { recursive: true, force: true }) } catch {}
  setStatus('disconnected', { reason: 'logged_out' })
  return { ok: true }
}

/** Reconnect a session paired earlier, so the shop scans the QR only once. */
async function restore(mainWindow) {
  win = mainWindow || win
  try {
    if (fs.existsSync(path.join(authDir(), 'creds.json'))) return connect(win)
  } catch {}
  return getStatus()
}

module.exports = { connect, restore, getStatus, sendMessage, sendDocument, logout }
