-- =================================================================================
-- Wholesale: part payment at billing, payments received from a party later, and
-- wholesale money in the cash figures.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Safe to run twice. Run it BEFORE using the new app version (the app still saves
-- bills the old way if this has not been run yet).
-- =================================================================================

-- What was paid at billing, and what is left due. payment_mode becomes 'credit'
-- whenever something is left due, so the existing edit function keeps working.
ALTER TABLE public.wholesale_sales ADD COLUMN IF NOT EXISTS cash_amount   NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.wholesale_sales ADD COLUMN IF NOT EXISTS upi_amount    NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.wholesale_sales ADD COLUMN IF NOT EXISTS cheque_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.wholesale_sales ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.wholesale_sales ADD COLUMN IF NOT EXISTS credit_paid   NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Bills made before this change: cash / UPI / cheque bills were paid in full, credit bills owe the whole amount.
UPDATE public.wholesale_sales SET
  cash_amount   = CASE WHEN payment_mode = 'cash'   THEN net_amount ELSE 0 END,
  upi_amount    = CASE WHEN payment_mode = 'upi'    THEN net_amount ELSE 0 END,
  cheque_amount = CASE WHEN payment_mode = 'cheque' THEN net_amount ELSE 0 END,
  credit_amount = CASE WHEN payment_mode = 'credit' THEN net_amount ELSE 0 END,
  credit_paid   = CASE WHEN payment_mode = 'credit' AND payment_status = 'paid' THEN net_amount ELSE 0 END
WHERE cash_amount = 0 AND upi_amount = 0 AND cheque_amount = 0 AND credit_amount = 0;

-- Every payment received from a party after the bill.
CREATE TABLE IF NOT EXISTS public.wholesale_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesale_customer_id UUID NOT NULL REFERENCES public.wholesale_customers(id),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  tender                TEXT NOT NULL CHECK (tender IN ('cash', 'upi', 'card', 'cheque')),
  paid_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  note                  TEXT,
  settled               JSONB NOT NULL DEFAULT '[]',   -- [{invoice_no, amount}] which bills it cleared
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wholesale_payments_party ON public.wholesale_payments(wholesale_customer_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_wholesale_payments_paid_at ON public.wholesale_payments(paid_at);
ALTER TABLE public.wholesale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_wholesale_payments" ON public.wholesale_payments;
CREATE POLICY "allow_all_wholesale_payments" ON public.wholesale_payments FOR ALL USING (true) WITH CHECK (true);

-- Editing a bill that still has something due: the difference lands on the due part
-- (edit_wholesale already moves the party's outstanding by the same difference).
CREATE OR REPLACE FUNCTION public.wholesale_edit_keeps_due() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.net_amount IS DISTINCT FROM OLD.net_amount
     AND OLD.payment_mode = 'credit' AND coalesce(OLD.payment_status, '') <> 'paid' THEN
    NEW.credit_amount := greatest(OLD.credit_paid, OLD.credit_amount + (NEW.net_amount - OLD.net_amount));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_wholesale_edit_keeps_due ON public.wholesale_sales;
CREATE TRIGGER trg_wholesale_edit_keeps_due BEFORE UPDATE OF net_amount ON public.wholesale_sales
  FOR EACH ROW EXECUTE FUNCTION public.wholesale_edit_keeps_due();

-- Record a payment from a party: it clears their oldest unpaid bills first.
CREATE OR REPLACE FUNCTION public.record_wholesale_payment(
  p_party UUID, p_amount NUMERIC, p_tender TEXT, p_paid_at TIMESTAMPTZ, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_due     NUMERIC;
  v_left    NUMERIC := round(p_amount, 2);
  v_take    NUMERIC;
  v_settled JSONB := '[]'::jsonb;
  r         RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter an amount greater than zero'; END IF;
  IF p_tender NOT IN ('cash', 'upi', 'card', 'cheque') THEN RAISE EXCEPTION 'Pick how it was paid'; END IF;
  PERFORM 1 FROM wholesale_customers WHERE id = p_party FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Party not found'; END IF;

  SELECT coalesce(sum(credit_amount - credit_paid), 0) INTO v_due
    FROM wholesale_sales WHERE wholesale_customer_id = p_party AND credit_amount - credit_paid > 0.009;
  IF v_left > v_due + 0.009 THEN
    RAISE EXCEPTION 'This party owes only ₹% — the payment is more than that', round(v_due, 2);
  END IF;

  FOR r IN
    SELECT id, invoice_no, credit_amount - credit_paid AS pending FROM wholesale_sales
     WHERE wholesale_customer_id = p_party AND credit_amount - credit_paid > 0.009
     ORDER BY created_at, id FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0.009;
    v_take := least(v_left, r.pending);
    UPDATE wholesale_sales SET
      credit_paid    = credit_paid + v_take,
      payment_status = CASE WHEN credit_amount - (credit_paid + v_take) <= 0.009 THEN 'paid' ELSE 'pending' END
    WHERE id = r.id;
    v_settled := v_settled || jsonb_build_object('invoice_no', r.invoice_no, 'amount', v_take);
    v_left := round(v_left - v_take, 2);
  END LOOP;

  UPDATE wholesale_customers SET outstanding_balance = greatest(0, coalesce(outstanding_balance, 0) - round(p_amount, 2))
   WHERE id = p_party;

  INSERT INTO wholesale_payments (wholesale_customer_id, amount, tender, paid_at, note, settled)
  VALUES (p_party, round(p_amount, 2), p_tender, coalesce(p_paid_at, now()), nullif(trim(p_note), ''), v_settled);

  RETURN jsonb_build_object('ok', true, 'settled', v_settled, 'still_due', round(v_due - round(p_amount, 2), 2));
END $$;

REVOKE EXECUTE ON FUNCTION public.record_wholesale_payment(UUID, NUMERIC, TEXT, TIMESTAMPTZ, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.record_wholesale_payment(UUID, NUMERIC, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
