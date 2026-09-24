-- =================================================================================
-- Partial settlement for payables and receivables
-- Run in: Supabase Dashboard → SQL Editor → project cogrniduhhoeepdkesjx
-- =================================================================================
--
-- WHY: the Accounts screen could only settle a bill in full, because neither table
-- recorded how much had been paid against it. These columns hold a running paid
-- total so a supplier or customer can pay in instalments.
--
-- DESIGN NOTE — purchase_bills.payment_status is left as 'pending' / 'paid' only.
-- That column pre-dates this project's tracked SQL and may carry a CHECK constraint
-- created in the dashboard, so writing a new 'partial' value could be rejected.
-- Partiality is expressed by amount_paid instead:
--     outstanding = net_amount - amount_paid
-- sales.credit_status DOES allow 'partial' (defined in ACCOUNTS_PURCHASING_SCHEMA.sql),
-- so receivables use it alongside credit_paid.
--
-- LIMITATION: these are running totals, not a payment ledger — individual payment
-- events (date, mode, reference) are not stored. That needs a payments table, which
-- is a larger change and deliberately not done here.
-- =================================================================================

-- Supplier payables
ALTER TABLE public.purchase_bills ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Customer udhar (the credit portion of a bill, which may be part of a split payment)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Bills already marked paid should read as fully settled, not as owing their full value.
UPDATE public.purchase_bills
   SET amount_paid = net_amount
 WHERE payment_status = 'paid'
   AND amount_paid = 0;

UPDATE public.sales
   SET credit_paid = credit_amount
 WHERE credit_status = 'paid'
   AND credit_amount > 0
   AND credit_paid = 0;


-- Verification (optional):
-- SELECT purchase_no, net_amount, amount_paid, payment_status,
--        net_amount - amount_paid AS outstanding
--   FROM public.purchase_bills WHERE payment_status <> 'paid';
