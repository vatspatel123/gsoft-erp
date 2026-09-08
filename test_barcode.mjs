import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testBarcodeUpdate() {
  const id = crypto.randomUUID()
  console.log('Inserting...')
  let res = await supabase.from('products').insert({
    id, name: 'Barcode Test', sku: 'BT-01', barcode: 'OLD-BARCODE',
    unit_price: 100, cost_price: 50, stock_qty: 10, is_active: true
  })
  console.log('Insert:', res.error ? res.error.message : 'OK')

  console.log('Updating barcode...')
  res = await supabase.from('products').update({ barcode: 'NEW-BARCODE' }).eq('id', id)
  console.log('Update:', res.error ? res.error.message : 'OK')

  await supabase.from('products').delete().eq('id', id)
  console.log('Done.')
}

testBarcodeUpdate()
