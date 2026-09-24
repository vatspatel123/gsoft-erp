-- =================================================================================
-- Fix credit_status default + backfill tender/credit columns on historical sales
-- Run in: Supabase Dashboard → SQL Editor → project cogrniduhhoeepdkesjx
-- =================================================================================
--
-- PROBLEM 1 — misleading default:
--   ACCOUNTS_PURCHASING_SCHEMA.sql gave sales.credit_status a DEFAULT of 'unpaid',
--   but POS only ever WROTE that column when a bill had a credit remainder. Result:
--   every fully-paid cash/card/UPI bill silently reads credit_status = 'unpaid'.
--   Harmless today (nothing reads it yet) but the Receivables module in the Accounts
--   screen is designed to read exactly this column, and would have counted all 43
--   existing bills as outstanding money.
--
-- PROBLEM 2 — historical rows have no tender breakdown:
--   Sales created before SPLIT_PAYMENT_SCHEMA.sql have cash/card/upi/credit_amount
--   all at 0. The Cash Book would therefore report zero cash for every past day, and
--   legacy credit sales (whole bill on udhar) would show credit_amount = 0 and be
--   under-counted by Receivables.
--
-- Returns (is_return = true) are deliberately excluded from the backfill so they
-- cannot double-count as money received.
-- =================================================================================


-- 1. A row with no payment information should not claim to be owed money.
ALTER TABLE public.sales ALTER COLUMN credit_status SET DEFAULT 'paid';


-- 2. Backfill the tender breakdown for historical, non-return sales.
UPDATE public.sales
   SET cash_amount = net_amount
 WHERE is_return IS NOT TRUE
   AND payment_mode = 'cash'
   AND cash_amount = 0 AND card_amount = 0 AND upi_amount = 0 AND credit_amount = 0;

UPDATE public.sales
   SET card_amount = net_amount
 WHERE is_return IS NOT TRUE
   AND payment_mode = 'card'
   AND cash_amount = 0 AND card_amount = 0 AND upi_amount = 0 AND credit_amount = 0;

UPDATE public.sales
   SET upi_amount = net_amount
 WHERE is_return IS NOT TRUE
   AND payment_mode = 'upi'
   AND cash_amount = 0 AND card_amount = 0 AND upi_amount = 0 AND credit_amount = 0;

-- Legacy credit sales: the entire bill was udhar.
UPDATE public.sales
   SET credit_amount = net_amount
 WHERE is_return IS NOT TRUE
   AND payment_mode = 'credit'
   AND cash_amount = 0 AND card_amount = 0 AND upi_amount = 0 AND credit_amount = 0;


-- 3. credit_status should reflect whether anything is actually outstanding.
UPDATE public.sales
   SET credit_status = 'paid'
 WHERE payment_mode <> 'credit'
   AND credit_status = 'unpaid';

UPDATE public.sales
   SET credit_status = 'unpaid'
 WHERE payment_mode = 'credit'
   AND credit_status IS NULL;


-- 4. Verification (optional — run after the above)
-- SELECT payment_mode, credit_status, COUNT(*),
--        SUM(cash_amount) AS cash, SUM(upi_amount) AS upi,
--        SUM(card_amount) AS card, SUM(credit_amount) AS credit
--   FROM public.sales WHERE is_return IS NOT TRUE
--  GROUP BY payment_mode, credit_status ORDER BY payment_mode;
