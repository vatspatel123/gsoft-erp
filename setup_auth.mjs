import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
// Using the service_role key provided earlier
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupAdminAccount() {
  const email = 'admin@retailerp.com'
  const password = 'AdminPassword123!'

  console.log('1. Creating admin auth user...')
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  })

  if (userError) {
    if (userError.message.includes('already exists')) {
      console.log('User already exists, fetching UID...')
      // Try to find the user manually if already exists (usually we'd just use a fixed ID or fail, 
      // but let's assume it succeeds if this is the first run)
    } else {
      console.error('Failed to create user:', userError.message)
      return
    }
  }

  const uid = userData?.user?.id
  if (!uid) {
    console.error('Could not get User ID!')
    return
  }
  
  console.log(`Created user successfully! UID: ${uid}`)

  console.log('2. Linking user to Default Store...')
  // Find the default store we created in the SQL migration
  const { data: stores, error: storeError } = await supabaseAdmin.from('stores').select('id').limit(1)
  
  if (storeError || !stores || stores.length === 0) {
    console.error('Could not find the Default Store. Did you run the SQL script?')
    return
  }

  const storeId = stores[0].id
  const { error: updateError } = await supabaseAdmin.from('stores').update({ owner_id: uid }).eq('id', storeId)
  
  if (updateError) {
    console.error('Failed to link store:', updateError.message)
    return
  }

  console.log('Successfully linked the admin account to the default store!')
  console.log('----------------------------------------------------')
  console.log('YOUR LOGIN CREDENTIALS:')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('----------------------------------------------------')
}

setupAdminAccount()
