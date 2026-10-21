-- =================================================================================
-- Customer due payments with their DATE
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- WHY: when a customer paid an old pending (udhar) amount, only a running total
-- (sales.credit_paid) was saved, with no date. So the Day Book and the Reports could
-- not show that cash on the day it was received. Each payment is now one row here,
-- and the Day Book / Reports count it on paid_at.
-- Payments made BEFORE this table existed have no date and are not added to any day;
-- the cash-in-hand total is unchanged (it still uses credit_paid).
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID REFERENCES public.stores(id),
  sale_id     UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  exchange_id UUID REFERENCES public.exchange_bills(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  tender      TEXT NOT NULL DEFAULT 'cash',
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_paid_at ON public.customer_payments (paid_at DESC);

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_payments read"   ON public.customer_payments;
DROP POLICY IF EXISTS "customer_payments insert" ON public.customer_payments;
CREATE POLICY "customer_payments read"   ON public.customer_payments FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "customer_payments insert" ON public.customer_payments FOR INSERT WITH CHECK (store_id = auth_store_id());
DROP TRIGGER IF EXISTS set_store_id_trigger ON public.customer_payments;
CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.customer_payments
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_auth();

-- Live refresh like the other screens (see LIVE_UPDATES.sql); skip quietly if already added.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_payments;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
