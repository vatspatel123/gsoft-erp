-- =================================================================================
-- Edit every column of a purchase bill, and add new items to it
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- p_items: [{ product_id? , product_name, design_no, pcode, size, colour, barcode,
--             qty, unit_cost, mrp, wholesale_price, online_price, gst_rate }]
-- A line without product_id is a new product. Details typed on a line become the
-- product's details. A barcode already used by another product is refused.

-- The category a product name files under, made the first time it is used
-- (products are named by their category in this shop).
CREATE OR REPLACE FUNCTION public.category_for(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM categories WHERE lower(trim(name)) = lower(trim(p_name)) LIMIT 1;
  IF v_id IS NULL THEN INSERT INTO categories (name) VALUES (trim(p_name)) RETURNING id INTO v_id; END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.category_for(TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.category_for(TEXT) TO authenticated;

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
  v_name       TEXT;
  v_code       TEXT;
  v_clash      TEXT;
  v_txt        TEXT;
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
    v_name := nullif(trim(coalesce(v_item ->> 'product_name', '')), '');
    v_code := nullif(trim(coalesce(v_item ->> 'barcode', '')), '');

    IF nullif(v_item ->> 'product_id', '') IS NULL THEN
      -- A new row: a new product, exactly as Purchase Entry would make it.
      IF v_name IS NULL THEN RAISE EXCEPTION 'Every new item needs a product name'; END IF;
      IF v_code IS NULL THEN RAISE EXCEPTION 'Every new item needs a barcode'; END IF;
      SELECT name INTO v_clash FROM products WHERE barcode = v_code LIMIT 1;
      IF FOUND THEN RAISE EXCEPTION 'Barcode % is already used by %', v_code, v_clash; END IF;
      INSERT INTO products (name, sku, barcode, category_id, supplier_id, unit_price, mrp, cost_price, online_price,
                            wholesale_price, gst_rate, stock_qty, low_stock_alert, design_no, pcode, size, colour, is_active)
      VALUES (v_name, 'SKU-' || v_code, v_code, category_for(v_name),
              CASE WHEN p_changes ? 'supplier_id' THEN nullif(p_changes ->> 'supplier_id', '')::uuid ELSE v_old.supplier_id END,
              nullif(v_item ->> 'mrp', '')::numeric, nullif(v_item ->> 'mrp', '')::numeric, (v_item ->> 'unit_cost')::numeric,
              coalesce(nullif(v_item ->> 'online_price', '')::numeric, nullif(v_item ->> 'mrp', '')::numeric),
              nullif(v_item ->> 'wholesale_price', '')::numeric, coalesce((v_item ->> 'gst_rate')::numeric, 5),
              0, 5, nullif(trim(v_item ->> 'design_no'), ''), nullif(trim(v_item ->> 'pcode'), ''),
              nullif(trim(v_item ->> 'size'), ''), nullif(trim(v_item ->> 'colour'), ''), true)
      RETURNING * INTO v_prod;                  -- stock arrives below, as the difference
    ELSE
      SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'An item on this bill is no longer in the product list'; END IF;
      -- Details typed on the bill are the product's details from now on.
      IF v_code IS NOT NULL AND v_code IS DISTINCT FROM v_prod.barcode THEN
        SELECT name INTO v_clash FROM products WHERE barcode = v_code AND id <> v_prod.id LIMIT 1;
        IF FOUND THEN RAISE EXCEPTION 'Barcode % is already used by %', v_code, v_clash; END IF;
      END IF;
      UPDATE products SET
        name            = coalesce(v_name, name),
        category_id     = CASE WHEN v_name IS NOT NULL AND lower(v_name) <> lower(name) THEN category_for(v_name) ELSE category_id END,
        barcode         = coalesce(v_code, barcode),
        design_no       = CASE WHEN v_item ? 'design_no' THEN nullif(trim(v_item ->> 'design_no'), '') ELSE design_no END,
        pcode           = CASE WHEN v_item ? 'pcode'     THEN nullif(trim(v_item ->> 'pcode'), '')     ELSE pcode END,
        size            = CASE WHEN v_item ? 'size'      THEN nullif(trim(v_item ->> 'size'), '')      ELSE size END,
        colour          = CASE WHEN v_item ? 'colour'    THEN nullif(trim(v_item ->> 'colour'), '')    ELSE colour END,
        wholesale_price = CASE WHEN v_item ? 'wholesale_price' THEN nullif(v_item ->> 'wholesale_price', '')::numeric ELSE wholesale_price END,
        online_price    = CASE WHEN v_item ? 'online_price' AND nullif(v_item ->> 'online_price', '') IS NOT NULL
                               THEN (v_item ->> 'online_price')::numeric ELSE online_price END
      WHERE id = v_prod.id RETURNING * INTO v_prod;
    END IF;
    v_qty  := (v_item ->> 'qty')::integer;
    v_cost := round((v_item ->> 'unit_cost')::numeric, 2);
    v_rate := coalesce((v_item ->> 'gst_rate')::numeric, v_prod.gst_rate, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be at least 1', v_prod.name; END IF;
    IF v_cost < 0 THEN RAISE EXCEPTION 'Cost for % cannot be negative', v_prod.name; END IF;
    IF v_rate < 0 OR v_rate > 28 THEN RAISE EXCEPTION 'GST for % must be 0–28%%', v_prod.name; END IF;
    v_subtotal := v_subtotal + v_qty * v_cost;
    v_gst := v_gst + v_qty * v_cost * v_rate / 100;           -- before discount; scaled below
    -- the line's previous MRP and batch, where the product was already on the bill
    SELECT x INTO v_prev FROM jsonb_array_elements(v_old_items) x WHERE (x ->> 'product_id')::uuid = v_prod.id LIMIT 1;
    v_new_items := v_new_items || jsonb_build_object(
      'product_id', v_prod.id, 'product_name', v_prod.name,
      'design_no', v_prod.design_no, 'pcode', v_prod.pcode, 'size', v_prod.size, 'colour', v_prod.colour,
      'batch_no', v_prev ->> 'batch_no', 'barcode', v_prod.barcode,
      'qty', v_qty, 'unit_cost', v_cost, 'mrp', coalesce(nullif(v_item ->> 'mrp', '')::numeric, (v_prev ->> 'mrp')::numeric, v_prod.mrp),
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
  -- A corrected MRP is the product's MRP and selling price from now on (they are the same here).
  UPDATE products p SET mrp = (x ->> 'mrp')::numeric, unit_price = (x ->> 'mrp')::numeric
    FROM jsonb_array_elements(v_new_items) x
   WHERE p.id = (x ->> 'product_id')::uuid AND (x ->> 'mrp') IS NOT NULL
     AND p.mrp IS DISTINCT FROM (x ->> 'mrp')::numeric;

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

