/**
 * A fetch that survives an expired login.
 *
 * The shop saw "Error: JWT expired" saving a purchase. The session renews itself
 * on a timer, but Windows pauses timers in a minimised window or a sleeping PC,
 * so after an idle spell the first save went out with a token an hour old and
 * the database refused it. Nothing was saved, but the cashier saw a raw error.
 *
 * Sitting under the Supabase client, this covers every screen at once: a data
 * request refused for an expired token renews the session once and is sent
 * again with the new one. Auth requests themselves pass straight through, so
 * renewing can never loop back into this.
 */

type Refresh = () => Promise<string | null>

const EXPIRED = /JWT expired|PGRST301|PGRST303|invalid JWT|token is expired/i

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

export function makeRefreshingFetch(base: typeof fetch, refresh: Refresh) {
  // Several screens can hit an expired token at the same moment; renew once.
  let inFlight: Promise<string | null> | null = null
  const renewOnce = () => {
    if (!inFlight) inFlight = refresh().finally(() => { inFlight = null })
    return inFlight
  }

  return async function refreshingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await base(input, init)
    if (res.status !== 401 || urlOf(input).includes('/auth/v1/')) return res

    const body = await res.clone().text().catch(() => '')
    if (!EXPIRED.test(body)) return res

    const token = await renewOnce().catch(() => null)
    if (!token) {
      // The session can't be renewed (signed out elsewhere, password changed).
      window.dispatchEvent(new CustomEvent('erp:session-expired'))
      return res
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.set('Authorization', `Bearer ${token}`)
    return base(input, { ...init, headers })
  }
}
