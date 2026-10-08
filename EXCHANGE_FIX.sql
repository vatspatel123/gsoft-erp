-- =================================================================================
-- Exchanges were never saved: balance_type was VARCHAR(10) on the live database,
-- but the app writes 'customer_pays' (13) and 'store_credit' (12). Every exchange
-- with a balance was rejected. EXCHANGE_SCHEMA.sql already says VARCHAR(20).
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
ALTER TABLE public.exchange_bills ALTER COLUMN balance_type TYPE VARCHAR(20);
