import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogrniduhhoeepdkesjx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ3JuaWR1aGhvZWVwZGtlc2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyMTc5NiwiZXhwIjoyMDg5Njk3Nzk2fQ.17FIelfCj3M3nYHwCFIZvtiLn2TVDggh4goRq9K7pI0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function seedTestLots() {
  console.log('Seeding Demo Old and New Stock...')
  
  const idOlder = crypto.randomUUID()
  const idNewer = crypto.randomUUID()
  
  // Set older date to 3 days ago
  const olderDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  // Set newer date to right now
  const newerDate = new Date().toISOString()
  
  const olderProduct = {
    id: idOlder,
    name: 'Client Demo Shirt',
    sku: 'DEMO-OLD',
    barcode: 'OLD-111',
    size: 'L',
    colour: 'Blue',
    unit_price: 999,
    cost_price: 500,
    stock_qty: 5,
    batch_no: 'BATCH-001',
    created_at: olderDate,
    is_active: true
  }

  const newerProduct = {
    id: idNewer,
    name: 'Client Demo Shirt', // Must be identical name
    sku: 'DEMO-NEW',
    barcode: 'NEW-222',
    size: 'L',         // Must be identical size
    colour: 'Blue',    // Must be identical colour
    unit_price: 999,
    cost_price: 500,
    stock_qty: 15,
    batch_no: 'BATCH-002',
    created_at: newerDate,
    is_active: true
  }

  const { error: err1 } = await supabase.from('products').insert(olderProduct)
  if (err1) { console.error('Error inserting older:', err1.message); return }
  
  const { error: err2 } = await supabase.from('products').insert(newerProduct)
  if (err2) { console.error('Error inserting newer:', err2.message); return }

  console.log('Successfully seeded the two demo items!')
}

seedTestLots()
