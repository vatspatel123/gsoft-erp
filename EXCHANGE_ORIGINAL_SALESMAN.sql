-- =================================================================================
-- Original salesman on an exchange: the salesman who first sold the returned pieces.
-- The value of the returned pieces comes off that salesman's sales on the exchange date
-- (Reports salesman list, Dashboard leaderboard).
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Safe to run twice. Until it is run the Exchange screen still works; the original
-- salesman just is not saved (the app tells you). Old exchanges are not touched.
-- =================================================================================
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS original_salesman_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exchange_bills_original_salesman_id ON public.exchange_bills(original_salesman_id);
