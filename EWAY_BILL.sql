-- =================================================================================
-- E-way bill: the party's PIN code is needed on every e-way bill.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
ALTER TABLE public.wholesale_customers ADD COLUMN IF NOT EXISTS pincode TEXT;
