import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  console.log('--- STORES ---')
  try {
    const { data: stores, error: sErr } = await supabaseAdmin.from('stores').select('*')
    console.log('Stores:', sErr ? sErr.message : stores)
  } catch (e) { console.error(e) }

  console.log('--- USERS (Staff/POS PINs) ---')
  try {
    const { data: users, error: uErr } = await supabaseAdmin.from('users').select('*')
    console.log('Users:', uErr ? uErr.message : users)
  } catch (e) { console.error(e) }

  console.log('--- AUTH USERS ---')
  try {
    const { data: authUsers, error: aErr } = await supabaseAdmin.auth.admin.listUsers()
    if (aErr) console.log('Auth error:', aErr.message)
    else console.log('Auth Users:', authUsers?.users?.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })))
  } catch (e) { console.error(e) }
}

run()
