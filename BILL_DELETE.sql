-- =================================================================================
-- Delete a sales bill or a purchase bill — admin password required
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Needs BILL_EDITS_SCHEMA.sql (bill_edits).
-- =================================================================================
-- Stock is put back, and a full copy of the bill is kept in bill_edits (after =
-- {"deleted": true}), so nothing disappears without a trace.

-- One password guards deletes: the admin's own login password (the account the
-- shop signs in with), checked against Supabase Auth's stored hash.
CREATE OR REPLACE FUNCTION public.admin_password_ok(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.id = auth.uid() AND u.encrypted_password IS NOT NULL
                    AND u.encrypted_password = crypt(coalesce(p_password, ''), u.encrypted_password))
$$;

-- ── Sales bill ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_sale(
  p_sale_id UUID, p_reason TEXT, p_admin_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_sale   sales%ROWTYPE;
  v_items  JSONB;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason for deleting the bill'; END IF;
  IF NOT admin_password_ok(p_admin_password) THEN RAISE EXCEPTION 'Admin password is wrong — bill not deleted'; END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_sale.is_return THEN RAISE EXCEPTION 'A return entry cannot be deleted'; END IF;
  IF EXISTS (SELECT 1 FROM sales WHERE return_ref_id = p_sale_id) THEN
    RAISE EXCEPTION 'Goods have been returned against this bill, so it cannot be deleted';
  END IF;
  IF EXISTS (SELECT 1 FROM exchange_bills WHERE original_sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'An exchange was made against this bill, so it cannot be deleted';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(si) ORDER BY si.id), '[]') INTO v_items FROM sale_items si WHERE si.sale_id = p_sale_id;

  -- The pieces go back on the shelf.
  UPDATE products p SET stock_qty = p.stock_qty + s.q
    FROM (SELECT product_id, sum(qty) q FROM sale_items WHERE sale_id = p_sale_id AND product_id IS NOT NULL GROUP BY 1) s
   WHERE p.id = s.product_id;

  -- The customer loses what the bill earned and gets back the points it used.
  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE customers SET
      loyalty_points = greatest(0, coalesce(loyalty_points, 0) - floor(v_sale.net_amount / 10)::int
                                   + coalesce(v_sale.loyalty_points_used, 0)),
      total_spent    = greatest(0, coalesce(total_spent, 0) - v_sale.net_amount)
    WHERE id = v_sale.customer_id;
  END IF;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, authorized_by, authorized_name, before, after)
  VALUES ('sale', p_sale_id, v_sale.invoice_no, 'DELETED: ' || trim(p_reason), NULL, 'Admin',
          jsonb_build_object('bill', to_jsonb(v_sale), 'items', v_items), '{"deleted": true}');

  DELETE FROM loyalty_transactions WHERE sale_id = p_sale_id;
  DELETE FROM sales WHERE id = p_sale_id;          -- sale_items go with it

  RETURN jsonb_build_object('ok', true, 'invoice_no', v_sale.invoice_no);
END $$;


-- ── Purchase bill ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_purchase(
  p_bill_id UUID, p_reason TEXT, p_admin_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_bill   purchase_bills%ROWTYPE;
  v_items  JSONB;
  v_short  RECORD;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason for deleting the bill'; END IF;
  IF NOT admin_password_ok(p_admin_password) THEN RAISE EXCEPTION 'Admin password is wrong — bill not deleted'; END IF;

  SELECT * INTO v_bill FROM purchase_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;

  -- Pieces from this bill that have already been sold can't be "un-bought".
  SELECT p.name, p.barcode, p.stock_qty, s.q INTO v_short
    FROM (SELECT product_id, sum(qty) q FROM purchase_items WHERE purchase_id = p_bill_id AND product_id IS NOT NULL GROUP BY 1) s
    JOIN products p ON p.id = s.product_id
   WHERE p.stock_qty < s.q LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '% (%) has only % in stock but this bill brought in % — some were sold, so the bill cannot be deleted',
      v_short.name, v_short.barcode, v_short.stock_qty, v_short.q;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(pi) ORDER BY pi.id), '[]') INTO v_items FROM purchase_items pi WHERE pi.purchase_id = p_bill_id;

  UPDATE products p SET stock_qty = p.stock_qty - s.q
    FROM (SELECT product_id, sum(qty) q FROM purchase_items WHERE purchase_id = p_bill_id AND product_id IS NOT NULL GROUP BY 1) s
   WHERE p.id = s.product_id;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, authorized_by, authorized_name, before, after)
  VALUES ('purchase', p_bill_id, v_bill.purchase_no, 'DELETED: ' || trim(p_reason), NULL, 'Admin',
          jsonb_build_object('bill', to_jsonb(v_bill), 'items', v_items), '{"deleted": true}');

  DELETE FROM purchase_bills WHERE id = p_bill_id;  -- purchase_items go with it

  RETURN jsonb_build_object('ok', true, 'purchase_no', v_bill.purchase_no);
END $$;

-- Earlier versions took a staff login as well.
DROP FUNCTION IF EXISTS public.delete_sale(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_purchase(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.owner_from_password(TEXT, TEXT);

REVOKE EXECUTE ON FUNCTION public.admin_password_ok(TEXT)              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_sale(UUID, TEXT, TEXT)        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_purchase(UUID, TEXT, TEXT)    FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.admin_password_ok(TEXT)              TO authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_sale(UUID, TEXT, TEXT)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_purchase(UUID, TEXT, TEXT)    TO authenticated;
