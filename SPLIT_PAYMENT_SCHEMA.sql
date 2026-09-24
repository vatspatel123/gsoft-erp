-- =================================================================================
-- Split / Multi-Tender Payments on Sales
-- Run in: Supabase Dashboard → SQL Editor → project cogrniduhhoeepdkesjx
-- =================================================================================
--
-- WHY: customers frequently pay part by UPI and the rest in cash. Until now `sales`
-- could record only a single payment_mode, so the breakdown was lost.
--
-- IMPORTANT DESIGN NOTE — payment_mode is NOT being replaced:
-- udhar/receivables are detected across the app purely by payment_mode = 'credit'
-- (CustomerHistoryModal, useInvoices' overdue filter, useNotifications). So:
--   * if any amount is left unpaid  -> payment_mode stays 'credit' (plus the
--     credit_due_* / credit_status columns added in ACCOUNTS_PURCHASING_SCHEMA.sql)
--   * otherwise                      -> payment_mode is the largest tender
-- The columns below only add the breakdown; every existing consumer keeps working.
-- =================================================================================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS card_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS upi_amount    NUMERIC(10,2) NOT NULL DEFAULT 0;
-- Unpaid remainder left on the customer's account (the udhar portion of a split bill):
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Useful for the Cash Book / Day Book module in the Accounts screen, which needs
-- actual cash received per day rather than "bills whose mode was cash".
CREATE INDEX IF NOT EXISTS idx_sales_cash_amount ON public.sales(created_at) WHERE cash_amount > 0;


-- Verification (optional):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'sales' AND column_name LIKE '%_amount';
