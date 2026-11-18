import { createClient } from '@supabase/supabase-js'
import { makeRefreshingFetch } from './refreshingFetch'

const cloudUrl = import.meta.env.VITE_SUPABASE_URL as string
const cloudKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Local mode (desktop app, switched on in Settings): the shop database runs on this PC and is
// backed up to the cloud a few times a day. Null in cloud mode and in the browser.
const local = window.electronAPI?.localDb?.config?.() ?? null
export const isLocalMode = !!local
const supabaseUrl = local?.url ?? cloudUrl
const supabaseAnonKey = local?.anonKey ?? cloudKey

if (local) {
  // ponytail: the database is on this PC, so "no internet" must not push bills into the offline
  // queue or block a screen. Only WhatsApp and website orders really need the internet, and
  // those already fail gently on their own.
  Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true, configurable: true })
  window.addEventListener('offline', e => e.stopImmediatePropagation(), true)
}

// Renews an expired login and retries, so a POS left idle doesn't fail its
// next save with "JWT expired". See refreshingFetch.ts.
const fetchWithRenewal = makeRefreshingFetch(
  (...args) => fetch(...args),
  async () => {
    const { data, error } = await supabase.auth.refreshSession()
    return error ? null : data.session?.access_token ?? null
  },
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true },
  global: { fetch: fetchWithRenewal },
})

/** The cloud project. In local mode only website orders and website settings use it
 *  (the website writes there); everything else is on this PC. Same client in cloud mode. */
export const cloud = local
  ? createClient(cloudUrl, cloudKey, { auth: { autoRefreshToken: true, persistSession: true } })
  : supabase
