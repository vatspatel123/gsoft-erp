import { createClient } from '@supabase/supabase-js'
import { makeRefreshingFetch } from './refreshingFetch'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

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
