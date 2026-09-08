-- Exchange & Return Module - Supabase Schema
-- Run this in the Supabase SQL Editor to create the required tables

-- 1. Exchange Bills (main exchange record)
CREATE TABLE IF NOT EXISTS exchange_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_no VARCHAR(50) NOT NULL UNIQUE,
  original_sale_id UUID REFERENCES sales(id),
  original_invoice_no VARCHAR(50),
  customer_id UUID REFERENCES customers(id),
  return_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  new_sale_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_type VARCHAR(20) DEFAULT 'nil', -- 'nil', 'customer_pays', 'store_credit'
  payment_mode VARCHAR(20) DEFAULT 'cash',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Exchange Return Items (items being returned)
CREATE TABLE IF NOT EXISTS exchange_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchange_bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Exchange New Items (replacement items given)
CREATE TABLE IF NOT EXISTS exchange_new_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchange_bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE exchange_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_new_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now — tighten in production)
DROP POLICY IF EXISTS "allow_all_exchange_bills" ON exchange_bills;
CREATE POLICY "allow_all_exchange_bills"
  ON exchange_bills FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_exchange_return_items" ON exchange_return_items;
CREATE POLICY "allow_all_exchange_return_items"
  ON exchange_return_items FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_exchange_new_items" ON exchange_new_items;
CREATE POLICY "allow_all_exchange_new_items"
  ON exchange_new_items FOR ALL
  USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exchange_bills_created_at ON exchange_bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_bills_original_sale_id ON exchange_bills(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_exchange_bills_customer_id ON exchange_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_exchange_return_items_exchange_id ON exchange_return_items(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_new_items_exchange_id ON exchange_new_items(exchange_id);
