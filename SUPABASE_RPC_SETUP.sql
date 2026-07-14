-- RPC Function to increment stock quantity for refunds
CREATE OR REPLACE FUNCTION increment_stock(p_id UUID, qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty + qty
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policy for sale_items to allow all operations
DROP POLICY IF EXISTS "allow_all_sale_items" ON sale_items;
CREATE POLICY "allow_all_sale_items"
  ON sale_items FOR ALL
  USING (true) WITH CHECK (true);

-- Optional: Create index on sales table for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_payment_mode ON sales(payment_mode);
CREATE INDEX IF NOT EXISTS idx_sales_salesman_id ON sales(salesman_id);

-- Verify the sales table structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'sales' ORDER BY ordinal_position;
