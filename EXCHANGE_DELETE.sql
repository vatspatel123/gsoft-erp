-- =================================================================================
-- Delete an exchange (admin password): undo its stock, credit note, loyalty
-- points and pending amount, and keep a copy in bill_edits.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Needs ADMIN_PASSWORD.sql (admin_password_ok).
-- =================================================================================
-- What an exchange gave as a refund, recorded from now on so it can be undone.
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS refund_mode    TEXT;   -- credit_note | cash | upi | loyalty
ALTER TABLE public.exchange_bills ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE SET NULL;

-- bill_edits keeps deleted exchanges too.
ALTER TABLE public.bill_edits DROP CONSTRAINT IF EXISTS bill_edits_bill_type_check;
ALTER TABLE public.bill_edits ADD CONSTRAINT bill_edits_bill_type_check CHECK (bill_type IN ('sale', 'purchase', 'exchange'));

CREATE OR REPLACE FUNCTION public.delete_exchange(p_exchange_id UUID, p_reason TEXT, p_admin_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_ex     exchange_bills%ROWTYPE;
  v_ret    JSONB;
  v_new    JSONB;
  v_cn     credit_notes%ROWTYPE;
  v_short  RECORD;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  IF NOT admin_password_ok(p_admin_password) THEN RAISE EXCEPTION 'Admin password is wrong — exchange not deleted'; END IF;

  SELECT * INTO v_ex FROM exchange_bills WHERE id = p_exchange_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF coalesce(v_ex.credit_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Money has already been collected against this exchange''s pending amount, so it cannot be deleted';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') INTO v_ret FROM exchange_return_items r WHERE r.exchange_id = p_exchange_id;
  SELECT coalesce(jsonb_agg(to_jsonb(n)), '[]') INTO v_new FROM exchange_new_items n WHERE n.exchange_id = p_exchange_id;

  -- The returned pieces must still be on the shelf to take them back out.
  SELECT p.name, p.barcode, p.stock_qty, s.q INTO v_short
    FROM (SELECT product_id, sum(qty) q FROM exchange_return_items WHERE exchange_id = p_exchange_id AND product_id IS NOT NULL GROUP BY 1) s
    JOIN products p ON p.id = s.product_id
   WHERE p.stock_qty < s.q LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '% (%) came back in this exchange but only % is in stock now — it was sold again, so the exchange cannot be deleted',
      v_short.name, v_short.barcode, v_short.stock_qty;
  END IF;

  -- The refund. A credit note is linked from now on; older ones are found by bill, amount and time.
  IF v_ex.balance_type = 'store_credit' THEN
    SELECT * INTO v_cn FROM credit_notes WHERE id = v_ex.credit_note_id;
    IF NOT FOUND AND v_ex.refund_mode IS NULL THEN
      SELECT * INTO v_cn FROM credit_notes
       WHERE original_sale_id = v_ex.original_sale_id AND amount = v_ex.balance_amount
         AND created_at BETWEEN v_ex.created_at - interval '2 minutes' AND v_ex.created_at + interval '10 minutes'
       ORDER BY abs(extract(epoch FROM created_at - v_ex.created_at)) LIMIT 1;
    END IF;
    IF v_cn.id IS NOT NULL THEN
      IF v_cn.balance_amount < v_cn.amount THEN
        RAISE EXCEPTION 'Credit note % has already been used (₹% of ₹% left), so the exchange cannot be deleted',
          v_cn.credit_note_no, v_cn.balance_amount, v_cn.amount;
      END IF;
      DELETE FROM credit_notes WHERE id = v_cn.id;
    ELSIF v_ex.refund_mode = 'loyalty' AND v_ex.customer_id IS NOT NULL THEN
      UPDATE customers SET loyalty_points = greatest(0, coalesce(loyalty_points, 0) - floor(v_ex.balance_amount * 4)::int)
       WHERE id = v_ex.customer_id;
    END IF;
  END IF;

  -- Stock back as it was: returned pieces out again, replacement pieces back in.
  UPDATE products p SET stock_qty = p.stock_qty - s.q
    FROM (SELECT product_id, sum(qty) q FROM exchange_return_items WHERE exchange_id = p_exchange_id AND product_id IS NOT NULL GROUP BY 1) s
   WHERE p.id = s.product_id;
  UPDATE products p SET stock_qty = p.stock_qty + s.q
    FROM (SELECT product_id, sum(qty) q FROM exchange_new_items WHERE exchange_id = p_exchange_id AND product_id IS NOT NULL GROUP BY 1) s
   WHERE p.id = s.product_id;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, authorized_name, before, after)
  VALUES ('exchange', p_exchange_id, v_ex.exchange_no, 'DELETED: ' || trim(p_reason), 'Admin',
          jsonb_build_object('bill', to_jsonb(v_ex), 'returned', v_ret, 'given', v_new,
                             'credit_note', CASE WHEN v_cn.id IS NOT NULL THEN to_jsonb(v_cn) END),
          '{"deleted": true}');

  DELETE FROM exchange_return_items WHERE exchange_id = p_exchange_id;
  DELETE FROM exchange_new_items    WHERE exchange_id = p_exchange_id;
  DELETE FROM exchange_bills        WHERE id = p_exchange_id;

  RETURN jsonb_build_object('ok', true, 'exchange_no', v_ex.exchange_no, 'original_invoice_no', v_ex.original_invoice_no,
                            'credit_note_removed', v_cn.credit_note_no);
END $$;

REVOKE EXECUTE ON FUNCTION public.delete_exchange(UUID, TEXT, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.delete_exchange(UUID, TEXT, TEXT) TO authenticated;
