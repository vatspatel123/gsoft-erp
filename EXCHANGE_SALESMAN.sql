-- =================================================================================
-- Salesperson on an exchange: who made the exchange gets the credit for it.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Safe to run twice. Until it is run the Exchange screen still works; the chosen
-- salesperson just is not saved (the app tells you).
-- =================================================================================
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exchange_bills_salesman_id ON public.exchange_bills(salesman_id);
