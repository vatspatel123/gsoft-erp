import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

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
