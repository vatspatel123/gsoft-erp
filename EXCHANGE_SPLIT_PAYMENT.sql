-- =================================================================================
-- Split payment on exchanges (cash / card / UPI), as at the POS
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- When the new items cost more than the returned ones, the customer can pay the
-- difference across cash, card and UPI. These hold what the shop kept of each;
-- payment_mode stays as the tender that carried most of it, for older screens.
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS card_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS upi_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;
