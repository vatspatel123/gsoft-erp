import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testOldLot() {
  console.log('--- Starting Old Lot Test ---')
  
  const idOlder = crypto.randomUUID()
  const idNewer = crypto.randomUUID()
  
  const olderDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const newerDate = new Date().toISOString()
  
  console.log('1. Inserting Older Product...')
  const { error: err1 } = await supabase.from('products').insert({
    id: idOlder,
    name: 'TEST-SHIRT',
    sku: 'TS-OLD-01',
    barcode: 'TS-OLD-01',
    size: 'M',
    colour: 'Red',
    unit_price: 500,
    cost_price: 300,
    stock_qty: 10,
    created_at: olderDate,
    is_active: true
  })
  if (err1) { console.error('Error inserting older:', err1); return }

  console.log('2. Inserting Newer Product...')
  const { error: err2 } = await supabase.from('products').insert({
    id: idNewer,
    name: 'TEST-SHIRT',
    sku: 'TS-NEW-02',
    barcode: 'TS-NEW-02',
    size: 'M',
    colour: 'Red',
    unit_price: 500,
    cost_price: 300,
    stock_qty: 15,
    created_at: newerDate,
    is_active: true
  })
  if (err2) { console.error('Error inserting newer:', err2); return }
  
  console.log('3. Running findOlderLot logic for Newer Product...')
  // Mimic usePOS.ts query
  const product = {
    id: idNewer,
    name: 'TEST-SHIRT',
    size: 'M',
    colour: 'Red',
    created_at: newerDate,
    design_no: null
  }
  
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .gt('stock_qty', 0)
    .neq('id', product.id)
    .eq('name', product.name)
    .eq('size', product.size)
    .eq('colour', product.colour)
    .lt('created_at', product.created_at)
    
  const { data, error } = await query.order('created_at', { ascending: true }).limit(1)
  
  if (error) {
    console.error('Query error:', error)
  } else if (data && data.length > 0) {
    console.log('SUCCESS! Found older lot:')
    console.log(`Expected SKU: TS-OLD-01 | Found SKU: ${data[0].sku}`)
    console.log(`Expected Date: ${olderDate} | Found Date: ${data[0].created_at}`)
  } else {
    console.log('FAILED! No older lot found.')
  }
  
  console.log('4. Cleaning up test data...')
  await supabase.from('products').delete().in('id', [idOlder, idNewer])
  console.log('--- Test Complete ---')
}

testOldLot()
