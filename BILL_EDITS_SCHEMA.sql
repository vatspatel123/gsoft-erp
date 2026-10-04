-- =================================================================================
-- Editing sales and purchase bills, with history and staff passwords
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
--
-- WHY THE EDITS LIVE IN THE DATABASE
-- A bill touches stock, loyalty points, udhar and supplier dues. Done from the
-- app as a string of separate writes, a dropped connection halfway through would
-- leave stock moved but the bill unchanged. edit_sale / edit_purchase do the
-- whole edit in one transaction: all of it lands, or none of it does.
--
-- WHAT AN EDIT MAY NOT TOUCH
-- Loyalty points already redeemed on a sale (the discount can't drop below them,
-- and the customer can't change), and the coupon. A credit note used on a bill
-- is also inside its discount, but the sale doesn't record how much, so the
-- screen warns rather than the database blocking.
--
-- STAFF PASSWORDS
-- Stored only as bcrypt hashes, in a table with row security on and no policies,
-- so the app can never read them back. The database answers only "is this
-- password right". Setting any password needs an owner's ID and password, except
-- the very first owner password, which is how the shop gets started.
-- ponytail: no lockout after repeated wrong passwords. Add a failed-attempt
-- counter if the shop ever needs one.
-- =================================================================================


-- ── 1. Edit history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_edits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES public.stores(id),
  bill_type        TEXT NOT NULL CHECK (bill_type IN ('sale', 'purchase')),
  bill_id          UUID NOT NULL,
  bill_no          TEXT,
  reason           TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  authorized_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  authorized_name  TEXT,
  edited_by_login  TEXT DEFAULT (auth.jwt() ->> 'email'),
  before           JSONB NOT NULL,
  after            JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_edits_bill ON public.bill_edits (bill_type, bill_id, created_at DESC);

ALTER TABLE public.bill_edits ENABLE ROW LEVEL SECURITY;
-- Read and add only. History is never changed or deleted from the app.
DROP POLICY IF EXISTS "bill_edits read"   ON public.bill_edits;
DROP POLICY IF EXISTS "bill_edits insert" ON public.bill_edits;
CREATE POLICY "bill_edits read"   ON public.bill_edits FOR SELECT USING (store_id = auth_store_id());
CREATE POLICY "bill_edits insert" ON public.bill_edits FOR INSERT WITH CHECK (store_id = auth_store_id());
DROP TRIGGER IF EXISTS set_store_id_trigger ON public.bill_edits;
CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.bill_edits
  FOR EACH ROW EXECUTE FUNCTION set_store_id_from_auth();

ALTER TABLE public.sales          ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;
ALTER TABLE public.sales          ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_bills ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;
ALTER TABLE public.purchase_bills ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;


-- ── 2. Staff passwords ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_credentials (
  user_id        UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;   -- and no policies
REVOKE ALL ON public.staff_credentials FROM anon, authenticated;

-- Who is this, if the password is right? Nothing if it is wrong.
CREATE OR REPLACE FUNCTION public.verify_staff_password(p_login TEXT, p_password TEXT)
RETURNS TABLE (id UUID, name TEXT, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT u.id, u.name::text, u.role::text
    FROM users u JOIN staff_credentials c ON c.user_id = u.id
   WHERE u.store_id = auth_store_id()
     AND u.is_active IS NOT FALSE
     AND lower(u.email) = lower(trim(p_login))
     AND c.password_hash = crypt(p_password, c.password_hash)
$$;

-- Which of these staff have a password set (for the Staff screen badges).
CREATE OR REPLACE FUNCTION public.staff_with_password()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.user_id FROM staff_credentials c JOIN users u ON u.id = c.user_id
   WHERE u.store_id = auth_store_id()
$$;

CREATE OR REPLACE FUNCTION public.set_staff_password(
  p_user_id UUID, p_new_password TEXT, p_owner_login TEXT DEFAULT NULL, p_owner_password TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_store UUID := auth_store_id();
  v_owner_has_pw BOOLEAN;
BEGIN
  IF v_store IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF length(coalesce(p_new_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND store_id = v_store) THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  SELECT EXISTS (SELECT 1 FROM users u JOIN staff_credentials c ON c.user_id = u.id
                  WHERE u.store_id = v_store AND u.role = 'owner' AND u.is_active IS NOT FALSE)
    INTO v_owner_has_pw;

  IF v_owner_has_pw THEN
    IF NOT EXISTS (SELECT 1 FROM verify_staff_password(p_owner_login, p_owner_password) v WHERE v.role = 'owner') THEN
      RAISE EXCEPTION 'Owner ID or password is wrong';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role = 'owner') THEN
    -- Starting out: the first password set must be an owner's, so an owner is
    -- always the one who controls everyone else's.
    RAISE EXCEPTION 'Set an owner password first';
  END IF;

  INSERT INTO staff_credentials (user_id, password_hash, updated_at)
       VALUES (p_user_id, crypt(p_new_password, gen_salt('bf', 10)), now())
  ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.verify_staff_password(TEXT, TEXT)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.staff_with_password()                     FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_staff_password(UUID, TEXT, TEXT, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.verify_staff_password(TEXT, TEXT)          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.staff_with_password()                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.set_staff_password(UUID, TEXT, TEXT, TEXT) TO authenticated;


-- ── 3. Edit a sale ───────────────────────────────────────────────────────────
-- p_changes: { customer_id?, salesman_id?, discount_amount?, cash_amount, card_amount, upi_amount }
--            A key that is absent means "leave as it was".
-- p_items:   [ { product_id, qty, unit_price, discount_pct } ]  — the whole new item list
-- Salesman changes need p_auth_login / p_auth_password of a staff member with a password.
CREATE OR REPLACE FUNCTION public.edit_sale(
  p_sale_id UUID, p_changes JSONB, p_items JSONB, p_reason TEXT,
  p_auth_login TEXT DEFAULT NULL, p_auth_password TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
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
    SELECT v.id, v.name INTO v_auth_id, v_auth_name FROM verify_staff_password(p_auth_login, p_auth_password) v;
    IF v_auth_id IS NULL THEN RAISE EXCEPTION 'Staff ID or password is wrong — salesman not changed'; END IF;
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
END $$;


-- ── 4. Edit a purchase bill ──────────────────────────────────────────────────
-- p_changes: { supplier_id?, supplier_invoice_no?, supplier_invoice_date?, discount_amount?, freight?, notes? }
-- p_items:   [ { product_id, qty, unit_cost, gst_rate } ]  — existing products only
CREATE OR REPLACE FUNCTION public.edit_purchase(
  p_bill_id UUID, p_changes JSONB, p_items JSONB, p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_old        purchase_bills%ROWTYPE;
  v_new        purchase_bills%ROWTYPE;
  v_old_items  JSONB;
  v_new_items  JSONB := '[]'::jsonb;
  v_item       JSONB;
  v_prod       products%ROWTYPE;
  v_prev       JSONB;
  v_qty        INTEGER;
  v_cost       NUMERIC;
  v_rate       NUMERIC;
  v_subtotal   NUMERIC := 0;
  v_gst        NUMERIC := 0;
  v_discount   NUMERIC;
  v_freight    NUMERIC;
  v_pre        NUMERIC;
  v_net        NUMERIC;
  r            RECORD;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason for the edit'; END IF;

  SELECT * INTO v_old FROM purchase_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A purchase bill needs at least one item';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(pi) ORDER BY pi.id), '[]') INTO v_old_items
    FROM purchase_items pi WHERE pi.purchase_id = p_bill_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item on this bill is no longer in the product list'; END IF;
    v_qty  := (v_item ->> 'qty')::integer;
    v_cost := round((v_item ->> 'unit_cost')::numeric, 2);
    v_rate := coalesce((v_item ->> 'gst_rate')::numeric, v_prod.gst_rate, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be at least 1', v_prod.name; END IF;
    IF v_cost < 0 THEN RAISE EXCEPTION 'Cost for % cannot be negative', v_prod.name; END IF;
    IF v_rate < 0 OR v_rate > 28 THEN RAISE EXCEPTION 'GST for % must be 0–28%%', v_prod.name; END IF;
    v_subtotal := v_subtotal + v_qty * v_cost;
    v_gst := v_gst + v_qty * v_cost * v_rate / 100;           -- before discount; scaled below
    -- keep the line's own labels (MRP, design, size) where the product was already on the bill
    SELECT x INTO v_prev FROM jsonb_array_elements(v_old_items) x WHERE (x ->> 'product_id')::uuid = v_prod.id LIMIT 1;
    v_new_items := v_new_items || jsonb_build_object(
      'product_id', v_prod.id, 'product_name', v_prod.name,
      'design_no', coalesce(v_prev ->> 'design_no', v_prod.design_no), 'pcode', coalesce(v_prev ->> 'pcode', v_prod.pcode),
      'size', coalesce(v_prev ->> 'size', v_prod.size), 'colour', coalesce(v_prev ->> 'colour', v_prod.colour),
      'batch_no', v_prev ->> 'batch_no', 'barcode', coalesce(v_prev ->> 'barcode', v_prod.barcode),
      'qty', v_qty, 'unit_cost', v_cost, 'mrp', coalesce((v_prev ->> 'mrp')::numeric, v_prod.mrp),
      'gst_rate', v_rate, 'line_total', round(v_qty * v_cost, 2));
  END LOOP;

  -- Stock moves by the difference; it can't be taken below what's left on the shelf.
  FOR r IN
    WITH o AS (SELECT (x ->> 'product_id')::uuid pid, sum((x ->> 'qty')::int) q FROM jsonb_array_elements(v_old_items) x GROUP BY 1),
         n AS (SELECT (x ->> 'product_id')::uuid pid, sum((x ->> 'qty')::int) q FROM jsonb_array_elements(v_new_items) x GROUP BY 1)
    SELECT coalesce(n.pid, o.pid) pid, coalesce(n.q, 0) - coalesce(o.q, 0) more_in
      FROM o FULL JOIN n ON n.pid = o.pid
  LOOP
    CONTINUE WHEN r.pid IS NULL OR r.more_in = 0;
    UPDATE products SET stock_qty = stock_qty + r.more_in WHERE id = r.pid RETURNING * INTO v_prod;
    IF FOUND AND v_prod.stock_qty < 0 THEN
      RAISE EXCEPTION 'Can''t remove % of % — only % left in stock (the rest is already sold)',
        -r.more_in, v_prod.name, v_prod.stock_qty - r.more_in;
    END IF;
  END LOOP;

  -- The latest cost entered is the product's cost, as in Purchase Entry.
  UPDATE products p SET cost_price = (x ->> 'unit_cost')::numeric
    FROM jsonb_array_elements(v_new_items) x
   WHERE p.id = (x ->> 'product_id')::uuid AND p.cost_price IS DISTINCT FROM (x ->> 'unit_cost')::numeric;

  v_discount := greatest(0, coalesce((p_changes ->> 'discount_amount')::numeric, v_old.discount_amount, 0));
  v_freight  := greatest(0, coalesce((p_changes ->> 'freight')::numeric, v_old.freight, 0));
  -- GST is on the value after the supplier's discount, as in Purchase Entry.
  v_discount := least(v_discount, v_subtotal);
  IF v_subtotal > 0 THEN v_gst := v_gst * (v_subtotal - v_discount) / v_subtotal; END IF;
  v_pre := v_subtotal - v_discount + v_freight + v_gst;
  v_net := round(v_pre);

  UPDATE purchase_bills SET
    supplier_id           = CASE WHEN p_changes ? 'supplier_id' THEN nullif(p_changes ->> 'supplier_id', '')::uuid ELSE supplier_id END,
    supplier_invoice_no   = CASE WHEN p_changes ? 'supplier_invoice_no' THEN nullif(p_changes ->> 'supplier_invoice_no', '') ELSE supplier_invoice_no END,
    supplier_invoice_date = CASE WHEN p_changes ? 'supplier_invoice_date' THEN nullif(p_changes ->> 'supplier_invoice_date', '')::date ELSE supplier_invoice_date END,
    notes                 = CASE WHEN p_changes ? 'notes' THEN nullif(p_changes ->> 'notes', '') ELSE notes END,
    subtotal        = round(v_subtotal, 2),
    discount_amount = round(v_discount, 2),
    freight         = round(v_freight, 2),
    gst_amount      = round(v_gst, 2),
    round_off       = round(v_net - v_pre, 2),
    net_amount      = v_net,
    payment_status  = CASE WHEN coalesce(amount_paid, 0) >= v_net THEN 'paid' ELSE 'pending' END,
    edited_at       = now(),
    edit_count      = coalesce(edit_count, 0) + 1
  WHERE id = p_bill_id
  RETURNING * INTO v_new;

  DELETE FROM purchase_items WHERE purchase_id = p_bill_id;
  INSERT INTO purchase_items (purchase_id, product_id, product_name, design_no, pcode, size, colour, batch_no,
                              barcode, qty, unit_cost, mrp, gst_rate, line_total)
  SELECT p_bill_id, (x ->> 'product_id')::uuid, x ->> 'product_name', x ->> 'design_no', x ->> 'pcode', x ->> 'size',
         x ->> 'colour', x ->> 'batch_no', x ->> 'barcode', (x ->> 'qty')::int, (x ->> 'unit_cost')::numeric,
         (x ->> 'mrp')::numeric, (x ->> 'gst_rate')::numeric, (x ->> 'line_total')::numeric
    FROM jsonb_array_elements(v_new_items) x;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, before, after)
  VALUES ('purchase', p_bill_id, v_old.purchase_no, trim(p_reason),
          jsonb_build_object('bill', to_jsonb(v_old), 'items', v_old_items),
          jsonb_build_object('bill', to_jsonb(v_new), 'items', v_new_items));

  RETURN jsonb_build_object('ok', true, 'net_amount', v_net, 'round_off', round(v_net - v_pre, 2),
                            'payment_status', v_new.payment_status, 'edit_count', v_new.edit_count);
END $$;

REVOKE EXECUTE ON FUNCTION public.edit_sale(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.edit_purchase(UUID, JSONB, JSONB, TEXT)        FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.edit_sale(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.edit_purchase(UUID, JSONB, JSONB, TEXT)        TO authenticated;
