import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function getColumns() {
  const { data, error } = await supabase.from('products').select('*').limit(1)
  if (error) {
    console.error(error)
  } else {
    console.log(Object.keys(data[0] || {}))
  }
}

getColumns()
