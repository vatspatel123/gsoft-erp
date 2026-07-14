-- Customers Module - Supabase SQL Schema Updates

-- Add missing columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create loyalty_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_change INT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual_credit', -- manual_credit, purchase, redemption, expiry
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id 
  ON loyalty_transactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at 
  ON loyalty_transactions(created_at DESC);

-- Enable RLS on loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "allow_all_loyalty" ON loyalty_transactions;

-- Create policy allowing all operations on loyalty_transactions
CREATE POLICY "allow_all_loyalty"
  ON loyalty_transactions FOR ALL
  USING (true) WITH CHECK (true);

-- Ensure customers table has proper indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customers_created_at 
  ON customers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_total_spent 
  ON customers(total_spent DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone 
  ON customers(phone);

CREATE INDEX IF NOT EXISTS idx_customers_name 
  ON customers(name);

-- Verify customers table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'customers';
