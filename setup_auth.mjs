import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
// Run with: SUPABASE_SERVICE_KEY=... ADMIN_PASSWORD=... node setup_auth.mjs
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupAdminAccount() {
  const email = 'admin@retailerp.com'
  const password = process.env.ADMIN_PASSWORD   // set it when running; never write it in this file

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
