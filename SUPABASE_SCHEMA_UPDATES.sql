-- Supabase Schema Updates for Inventory Module
-- Run these commands in the Supabase SQL Editor

-- Add missing columns to stock_damage_log table
ALTER TABLE stock_damage_log
ADD COLUMN IF NOT EXISTS qty_before INTEGER DEFAULT 0;

ALTER TABLE stock_damage_log
ADD COLUMN IF NOT EXISTS qty_after INTEGER DEFAULT 0;

ALTER TABLE stock_damage_log
ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(20) DEFAULT 'remove';

ALTER TABLE stock_damage_log
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create physical_stock_counts table if doesn't exist
CREATE TABLE IF NOT EXISTS physical_stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_qty INTEGER NOT NULL,
  physical_qty INTEGER NOT NULL,
  difference INTEGER COMPUTED GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
  counted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE physical_stock_counts ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "allow_all_damage" ON stock_damage_log;
CREATE POLICY "allow_all_damage"
  ON stock_damage_log FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_stock_counts" ON physical_stock_counts;
CREATE POLICY "allow_all_stock_counts"
  ON physical_stock_counts FOR ALL
  USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_damage_log_product_id 
  ON stock_damage_log(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_damage_log_created_at 
  ON stock_damage_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_product_id 
  ON physical_stock_counts(product_id);

CREATE INDEX IF NOT EXISTS idx_physical_stock_counts_counted_at 
  ON physical_stock_counts(counted_at DESC);
