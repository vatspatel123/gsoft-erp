import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { getSettings, billPrintWidthMm } from './settings'
import type { WhatsAppState } from '../types'

// One way out for every WhatsApp message in the app.
//
// When the shop has linked WhatsApp (Settings -> WhatsApp), messages go through
// the relay service and send silently in the background. Otherwise we fall back
// to the wa.me deep link, which is what the app always did.

// Resolved per call, not frozen at build time. Baking this in meant a build made
// without the env var silently hid the whole WhatsApp screen, with no way for the
// shop to switch relays without a rebuild. The setting wins; the build-time env
// var is only a default for fresh installs.
const relayUrl = (): string => {
  const fromSettings = getSettings().waServerUrl
  const fallback = import.meta.env.VITE_WA_SERVER_URL as string | undefined
  return String(fromSettings ?? fallback ?? '').trim().replace(/\/$/, '')
}

export const waPhone = (phone: string): string => {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length === 10 ? '91' + digits : digits
}

export const waLink = (phone: string, text?: string): string =>
  `https://wa.me/${waPhone(phone)}` + (text ? `?text=${encodeURIComponent(text)}` : '')

/**
 * WhatsApp running inside the desktop app. This is the path the shop uses: the
 * session lives in the app itself, so no separate service has to be installed
 * and the QR appears on the shop's own PC.
 */
const desktop = () => window.electronAPI?.whatsapp

export const isRelayConfigured = () => !!desktop() || !!relayUrl()

async function call(path: string, init: RequestInit = {}) {
  const server = relayUrl()
  if (!server) throw new Error('WhatsApp server is not configured')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  const res = await fetch(`${server}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

export const waStatus = (): Promise<WhatsAppState> =>
  desktop() ? desktop()!.status() : call('/status')

export const waConnect = (reset = false): Promise<WhatsAppState> =>
  desktop() ? desktop()!.connect({ reset })
            : call('/connect', { method: 'POST', body: JSON.stringify({ reset }) })

export const waLogout = (): Promise<{ ok: boolean }> =>
  desktop() ? desktop()!.logout() : call('/logout', { method: 'POST' })

/** Live status updates while the QR is on screen (desktop only). */
export const onWaStatus = (cb: (s: WhatsAppState) => void): (() => void) =>
  desktop()?.onStatus(cb) ?? (() => {})

export const canSendDirect = async (): Promise<boolean> => {
  if (desktop()) {
    try { return (await desktop()!.status()).status === 'connected' } catch { return false }
  }
  if (!relayUrl()) return false
  try {
    return (await waStatus()).status === 'connected'
  } catch {
    return false
  }
}

// Several callers already hand us a URL-encoded message (built with %0A etc.
// for wa.me links). Direct sending needs the plain text, so decode those.
const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

// "Not linked yet" and "relay unreachable" are both normal for a build without a
// running relay, so they fall back to wa.me silently. Anything else — number not
// on WhatsApp, rate limited — is a real failure the shop should be told about.
const isExpectedFallback = (msg: string) =>
  /not connected|not configured|Failed to fetch|NetworkError|Load failed|Not signed in/i.test(msg)

// Desktop app: never throw the cashier out to a browser tab. Say what to fix.
function desktopFailed(err?: string) {
  const msg = String(err || 'Send failed')
  toast.error(/not linked/i.test(msg)
    ? 'WhatsApp is not linked on this PC. Go to Settings → WhatsApp and scan the QR once — then sending is direct.'
    : `WhatsApp: ${msg}`, { id: 'wa-fail', duration: 7000 })
}

/**
 * Send a rendered document (the bill) as a PDF attachment with a text caption.
 * The relay turns the HTML into the PDF, so the attachment is pixel-identical
 * to what the printer produces.
 *
 * Falls back to sending just the caption — and then to a wa.me link — so the
 * customer always gets their bill details even when the relay is unavailable.
 */
export async function sendWhatsAppDocument(
  phone: string,
  opts: { html: string; caption: string; fileName: string; encoded?: boolean }
): Promise<'sent' | 'text' | 'browser' | 'failed'> {
  const caption = opts.encoded ? decode(opts.caption) : opts.caption

  // Desktop app: build the PDF with the app's own renderer and attach it. The
  // shop needs no separate service for this.
  const d = desktop()
  if (d) {
    try {
      const pdf = await window.electronAPI!.printing!.renderPDF!({
        html: opts.html, widthMm: billPrintWidthMm(),
      })
      if (!pdf?.ok || !pdf.base64) throw new Error(pdf?.error || 'Could not build the PDF')
      const res = await d.sendDocument({
        phone, pdfBase64: pdf.base64, fileName: opts.fileName, caption,
      })
      if (res.ok) { toast.success('Bill PDF sent on WhatsApp ✅'); return 'sent' }
      desktopFailed(res.error)
    } catch (e: any) {
      desktopFailed(e?.message)
    }
    return 'failed'
  }

  if (relayUrl()) {
    try {
      await call('/send-document', {
        method: 'POST',
        body: JSON.stringify({
          phone, html: opts.html, caption, fileName: opts.fileName,
          widthMm: billPrintWidthMm(),
        }),
      })
      toast.success('Bill PDF sent on WhatsApp ✅')
      return 'sent'
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (!isExpectedFallback(msg)) {
        // PDF rendering can fail where plain text still works — try that before
        // falling back to a browser tab.
        toast.error(`Could not send the PDF (${msg}) — sending the details as text`)
        const how = await sendWhatsApp(phone, caption, { silent: true })
        if (how === 'sent') return 'text'
        return 'browser'
      }
    }
  }

  window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(caption)}`, '_blank')
  return 'browser'
}

export async function sendWhatsApp(
  phone: string,
  text: string,
  opts: { silent?: boolean; encoded?: boolean; features?: string } = {}
): Promise<'sent' | 'browser' | 'failed'> {
  const d = desktop()
  if (d) {
    try {
      const res = await d.send(phone, opts.encoded ? decode(text) : text)
      if (res.ok) { if (!opts.silent) toast.success('Sent on WhatsApp ✅'); return 'sent' }
      desktopFailed(res.error)
    } catch (e: any) {
      desktopFailed(e?.message)
    }
    return 'failed'
  }

  if (relayUrl()) {
    try {
      await call('/send', {
        method: 'POST',
        body: JSON.stringify({ phone, text: opts.encoded ? decode(text) : text }),
      })
      if (!opts.silent) toast.success('Sent on WhatsApp ✅')
      return 'sent'
    } catch (e: any) {
      // Not linked yet is the normal case before setup — don't nag about it.
      const msg = String(e?.message || '')
      if (!isExpectedFallback(msg)) toast.error(`${msg} — opening WhatsApp instead`)
    }
  }
  const url = `https://wa.me/${waPhone(phone)}?text=${opts.encoded ? text : encodeURIComponent(text)}`
  window.open(url, '_blank', opts.features)
  return 'browser'
}
