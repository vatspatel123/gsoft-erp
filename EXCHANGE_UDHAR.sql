-- =================================================================================
-- Udhar on exchanges
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- When the replacement costs more and the customer doesn't pay it all, the rest
-- is udhar — the same fields sales use, so Accounts -> Receivables lists and
-- settles exchange udhar alongside sales udhar.
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_paid     NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_status   TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_due_date DATE;
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_tender   TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_bills_credit_status_check') THEN
    ALTER TABLE public.exchange_bills ADD CONSTRAINT exchange_bills_credit_status_check
      CHECK (credit_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;
