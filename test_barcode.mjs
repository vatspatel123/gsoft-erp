import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
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
