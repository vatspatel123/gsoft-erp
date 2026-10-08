-- =================================================================================
-- One Admin password, known only to the owner, for approvals: changing the
-- salesman on a bill and deleting a bill. No email or staff ID.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- Until it is set, the shop's sign-in password still works (as before), so
-- nothing changes for the shop until the owner sets one in Settings.

CREATE TABLE IF NOT EXISTS public.admin_secrets (
  store_id       UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  password_hash  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;      -- and no policies:
REVOKE ALL ON public.admin_secrets FROM anon, authenticated;     -- only the functions below read it

-- Is this the admin password? The shop's own Admin password once set, otherwise
-- the sign-in password of the account (as before).
CREATE OR REPLACE FUNCTION public.admin_password_ok(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM admin_secrets WHERE store_id = auth_store_id())
      THEN EXISTS (SELECT 1 FROM admin_secrets a WHERE a.store_id = auth_store_id()
                    AND a.password_hash = crypt(coalesce(p_password, ''), a.password_hash))
    ELSE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.encrypted_password IS NOT NULL
                    AND u.encrypted_password = crypt(coalesce(p_password, ''), u.encrypted_password))
  END
$$;

-- Set or change it: the current admin password is needed (the sign-in password
-- the first time).
CREATE OR REPLACE FUNCTION public.set_admin_password(p_current TEXT, p_new TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF auth_store_id() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT admin_password_ok(p_current) THEN RAISE EXCEPTION 'Current password is wrong'; END IF;
  IF length(coalesce(p_new, '')) < 4 THEN RAISE EXCEPTION 'The new password needs at least 4 characters'; END IF;
  INSERT INTO admin_secrets (store_id, password_hash, updated_at)
  VALUES (auth_store_id(), crypt(p_new, gen_salt('bf')), now())
  ON CONFLICT (store_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_password_ok(TEXT)        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_admin_password(TEXT, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.admin_password_ok(TEXT)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.set_admin_password(TEXT, TEXT) TO authenticated;

-- Changing the salesman on a bill now asks for the admin password alone.
CREATE OR REPLACE FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text DEFAULT NULL::text, p_auth_password text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_old          sales%ROWTYPE;
  v_new          sales%ROWTYPE;
  v_old_items    JSONB;
  v_new_items    JSONB := '[]'::jsonb;
  v_item         JSONB;
  v_prod         products%ROWTYPE;
  v_qty          INTEGER;
  v_price        NUMERIC;
  v_disc         NUMERIC;
  v_line         NUMERIC;
  v_subtotal     NUMERIC := 0;
  v_gst          NUMERIC := 0;
  v_discount     NUMERIC;
  v_min_discount NUMERIC;
  v_net          NUMERIC;
  v_cash         NUMERIC;
  v_card         NUMERIC;
  v_upi          NUMERIC;
  v_udhar        NUMERIC;
  v_over         NUMERIC;
  v_take         NUMERIC;
  v_customer     UUID;
  v_salesman     UUID;
  v_auth_id      UUID;
  v_auth_name    TEXT;
  r              RECORD;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason for the edit'; END IF;

  SELECT * INTO v_old FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_old.is_return THEN RAISE EXCEPTION 'A return cannot be edited; make a new return instead'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A bill needs at least one item';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(si) ORDER BY si.id), '[]') INTO v_old_items
    FROM sale_items si WHERE si.sale_id = p_sale_id;

  -- Salesman: only with a staff ID and password.
  v_salesman := CASE WHEN p_changes ? 'salesman_id'
                     THEN nullif(p_changes ->> 'salesman_id', '')::uuid ELSE v_old.salesman_id END;
  IF v_salesman IS DISTINCT FROM v_old.salesman_id THEN
    -- The admin password alone (p_auth_login is no longer used).
    IF NOT admin_password_ok(p_auth_password) THEN RAISE EXCEPTION 'Admin password is wrong — salesman not changed'; END IF;
    v_auth_name := 'Admin';
  END IF;

  -- The new item list, priced the way the POS prices it (GST inside the price).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item on this bill is no longer in the product list'; END IF;
    v_qty   := (v_item ->> 'qty')::integer;
    v_price := round((v_item ->> 'unit_price')::numeric, 2);
    v_disc  := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be at least 1', v_prod.name; END IF;
    IF v_price < 0 THEN RAISE EXCEPTION 'Rate for % cannot be negative', v_prod.name; END IF;
    IF v_disc < 0 OR v_disc > 100 THEN RAISE EXCEPTION 'Discount for % must be 0–100%%', v_prod.name; END IF;
    v_line := round(v_price * v_qty * (1 - v_disc / 100), 2);
    v_subtotal := v_subtotal + v_line;
    IF coalesce(v_prod.gst_rate, 0) > 0 THEN
      v_gst := v_gst + (v_line - v_line / (1 + v_prod.gst_rate / 100));
    END IF;
    v_new_items := v_new_items || jsonb_build_object(
      'product_id', v_prod.id, 'barcode', coalesce(v_prod.barcode, v_prod.sku), 'qty', v_qty,
      'unit_price', v_price, 'discount_pct', v_disc, 'gst_rate', v_prod.gst_rate, 'line_total', v_line);
  END LOOP;

  -- Items can't change once goods have come back against this bill.
  IF EXISTS (SELECT 1 FROM sales WHERE return_ref_id = p_sale_id)
     AND (SELECT coalesce(jsonb_agg(jsonb_build_object('p', x ->> 'product_id', 'q', (x ->> 'qty')::int) ORDER BY x ->> 'product_id'), '[]')
            FROM jsonb_array_elements(v_new_items) x)
      <> (SELECT coalesce(jsonb_agg(jsonb_build_object('p', x ->> 'product_id', 'q', (x ->> 'qty')::int) ORDER BY x ->> 'product_id'), '[]')
            FROM jsonb_array_elements(v_old_items) x) THEN
    RAISE EXCEPTION 'Items on this bill have been returned, so only its details and payment can be edited';
  END IF;

  -- Stock moves by the difference only.
  FOR r IN
    WITH o AS (SELECT (x ->> 'product_id')::uuid pid, sum((x ->> 'qty')::int) q FROM jsonb_array_elements(v_old_items) x GROUP BY 1),
         n AS (SELECT (x ->> 'product_id')::uuid pid, sum((x ->> 'qty')::int) q FROM jsonb_array_elements(v_new_items) x GROUP BY 1)
    SELECT coalesce(n.pid, o.pid) pid, coalesce(n.q, 0) - coalesce(o.q, 0) more_sold
      FROM o FULL JOIN n ON n.pid = o.pid
  LOOP
    CONTINUE WHEN r.pid IS NULL OR r.more_sold = 0;
    UPDATE products SET stock_qty = stock_qty - r.more_sold WHERE id = r.pid RETURNING * INTO v_prod;
    IF FOUND AND v_prod.stock_qty < 0 THEN
      RAISE EXCEPTION 'Not enough stock of % — only % more available', v_prod.name, v_prod.stock_qty + r.more_sold;
    END IF;
  END LOOP;

  -- Totals. Loyalty points already redeemed on this bill stay in the discount.
  -- (A credit note used on the bill is folded into discount_amount too, but the
  -- sale doesn't record how much of it was credit note, so it can't be held here.)
  v_min_discount := coalesce(v_old.loyalty_points_used, 0) * 0.25;
  v_discount := coalesce((p_changes ->> 'discount_amount')::numeric, v_old.discount_amount, 0);
  IF v_discount < v_min_discount THEN
    RAISE EXCEPTION 'Discount cannot go below ₹% — that part was paid with loyalty points', round(v_min_discount, 2);
  END IF;
  v_discount := least(v_discount, v_subtotal);
  v_net := round(v_subtotal - v_discount, 2);

  v_cash := greatest(0, coalesce((p_changes ->> 'cash_amount')::numeric, v_old.cash_amount, 0));
  v_card := greatest(0, coalesce((p_changes ->> 'card_amount')::numeric, v_old.card_amount, 0));
  v_upi  := greatest(0, coalesce((p_changes ->> 'upi_amount')::numeric,  v_old.upi_amount,  0));
  -- Keep only what the shop keeps: anything over the bill is change handed
  -- back, taken off cash first, then UPI, then card.
  v_over := round(v_cash + v_card + v_upi - v_net, 2);
  IF v_over > 0 THEN
    v_take := least(v_cash, v_over); v_cash := v_cash - v_take; v_over := v_over - v_take;
    v_take := least(v_upi,  v_over); v_upi  := v_upi  - v_take; v_over := v_over - v_take;
    v_take := least(v_card, v_over); v_card := v_card - v_take;
  END IF;
  v_udhar := greatest(0, round(v_net - v_cash - v_card - v_upi, 2));

  -- Customer: loyalty and total spent follow the bill.
  v_customer := CASE WHEN p_changes ? 'customer_id'
                     THEN nullif(p_changes ->> 'customer_id', '')::uuid ELSE v_old.customer_id END;
  IF v_customer IS DISTINCT FROM v_old.customer_id AND coalesce(v_old.loyalty_points_used, 0) > 0 THEN
    RAISE EXCEPTION 'This bill used the customer''s loyalty points, so the customer cannot be changed';
  END IF;
  IF v_old.customer_id IS NOT NULL THEN
    UPDATE customers SET loyalty_points = greatest(0, coalesce(loyalty_points, 0) - floor(v_old.net_amount / 10)::int),
                         total_spent    = greatest(0, coalesce(total_spent, 0) - v_old.net_amount)
     WHERE id = v_old.customer_id;
  END IF;
  IF v_customer IS NOT NULL THEN
    UPDATE customers SET loyalty_points = coalesce(loyalty_points, 0) + floor(v_net / 10)::int,
                         total_spent    = coalesce(total_spent, 0) + v_net
     WHERE id = v_customer;
  END IF;

  UPDATE sales SET
    customer_id     = v_customer,
    salesman_id     = v_salesman,
    total_amount    = round(v_subtotal, 2),
    discount_amount = round(v_discount, 2),
    net_amount      = v_net,
    gst_amount      = round(v_gst, 2),
    cash_amount     = v_cash,
    card_amount     = v_card,
    upi_amount      = v_upi,
    credit_amount   = v_udhar,
    payment_mode    = CASE WHEN v_udhar > 0.009 THEN 'credit'
                           WHEN v_cash + v_card + v_upi <= 0 THEN 'cash'
                           WHEN v_upi >= v_cash AND v_upi >= v_card THEN 'upi'
                           WHEN v_card >= v_cash THEN 'card' ELSE 'cash' END,
    credit_status   = CASE WHEN v_udhar <= 0.009 THEN 'paid'
                           WHEN coalesce(credit_paid, 0) >= v_udhar THEN 'paid'
                           WHEN coalesce(credit_paid, 0) > 0 THEN 'partial' ELSE 'unpaid' END,
    credit_due_date = CASE WHEN v_udhar > 0.009
                           THEN coalesce(credit_due_date, current_date + coalesce(credit_due_days, 5)) END,
    edited_at       = now(),
    edit_count      = coalesce(edit_count, 0) + 1
  WHERE id = p_sale_id
  RETURNING * INTO v_new;

  DELETE FROM sale_items WHERE sale_id = p_sale_id;
  INSERT INTO sale_items (sale_id, product_id, barcode, qty, unit_price, discount_pct, gst_rate, line_total)
  SELECT p_sale_id, (x ->> 'product_id')::uuid, x ->> 'barcode', (x ->> 'qty')::int, (x ->> 'unit_price')::numeric,
         (x ->> 'discount_pct')::numeric, (x ->> 'gst_rate')::numeric, (x ->> 'line_total')::numeric
    FROM jsonb_array_elements(v_new_items) x;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, authorized_by, authorized_name, before, after)
  VALUES ('sale', p_sale_id, v_old.invoice_no, trim(p_reason), v_auth_id, v_auth_name,
          jsonb_build_object('bill', to_jsonb(v_old), 'items', v_old_items),
          jsonb_build_object('bill', to_jsonb(v_new), 'items', v_new_items));

  RETURN jsonb_build_object('ok', true, 'net_amount', v_net, 'udhar', v_udhar, 'edit_count', v_new.edit_count);
END $function$;
