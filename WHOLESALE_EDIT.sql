-- =================================================================================
-- Edit a wholesale bill: items (add, copy, change, remove), discount %, freight,
-- GST type and notes — in one transaction, like edit_sale / edit_purchase.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- Prices are the Wholesale screen's (useWholesale.ts): GST is added on top of the
-- line after its discount; the bill discount % comes off before GST; freight is
-- added; the net is rounded to the rupee. Stock and the party's outstanding /
-- total business move by the difference only. The old version goes to bill_edits.

ALTER TABLE bill_edits DROP CONSTRAINT IF EXISTS bill_edits_bill_type_check;
ALTER TABLE bill_edits ADD CONSTRAINT bill_edits_bill_type_check
  CHECK (bill_type = ANY (ARRAY['sale', 'purchase', 'exchange', 'wholesale']));

-- p_changes: { discount_pct, freight, gst_type, notes }
-- p_items:   [{ product_id, qty, unit_price, mrp, discount_pct, gst_rate }]
CREATE OR REPLACE FUNCTION public.edit_wholesale(p_id UUID, p_changes JSONB, p_items JSONB, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_old       wholesale_sales%ROWTYPE;
  v_new       wholesale_sales%ROWTYPE;
  v_old_items JSONB;
  v_new_items JSONB := '[]'::jsonb;
  v_item      JSONB;
  v_prod      products%ROWTYPE;
  v_qty       INTEGER;
  v_price     NUMERIC;
  v_disc      NUMERIC;
  v_gst_rate  NUMERIC;
  v_taxable   NUMERIC;
  v_subtotal  NUMERIC := 0;
  v_item_gst  NUMERIC := 0;
  v_bill_pct  NUMERIC;
  v_bill_disc NUMERIC;
  v_gst       NUMERIC;
  v_freight   NUMERIC;
  v_raw       NUMERIC;
  v_net       NUMERIC;
  r           RECORD;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Please give a reason for the edit'; END IF;

  SELECT * INTO v_old FROM wholesale_sales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A bill needs at least one item';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id), '[]') INTO v_old_items
    FROM wholesale_sale_items i WHERE i.wholesale_sale_id = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item on this bill is no longer in the product list'; END IF;
    v_qty      := (v_item ->> 'qty')::integer;
    v_price    := round((v_item ->> 'unit_price')::numeric, 2);
    v_disc     := coalesce((v_item ->> 'discount_pct')::numeric, 0);
    v_gst_rate := coalesce((v_item ->> 'gst_rate')::numeric, v_prod.gst_rate, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantity for % must be at least 1', v_prod.name; END IF;
    IF v_price < 0 THEN RAISE EXCEPTION 'Rate for % cannot be negative', v_prod.name; END IF;
    IF v_disc < 0 OR v_disc > 100 THEN RAISE EXCEPTION 'Discount for % must be 0–100%%', v_prod.name; END IF;
    v_taxable  := v_qty * v_price * (1 - v_disc / 100);
    v_subtotal := v_subtotal + v_taxable;
    v_item_gst := v_item_gst + v_taxable * v_gst_rate / 100;
    v_new_items := v_new_items || jsonb_build_object(
      'product_id', v_prod.id, 'qty', v_qty, 'unit_price', v_price,
      'mrp', coalesce(nullif(v_item ->> 'mrp', '')::numeric, v_prod.mrp, v_price),
      'discount_pct', v_disc, 'gst_rate', v_gst_rate,
      'line_total', round(v_taxable * (1 + v_gst_rate / 100), 2));
  END LOOP;

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

  v_bill_pct  := least(100, greatest(0, coalesce((p_changes ->> 'discount_pct')::numeric, v_old.discount_pct, 0)));
  v_freight   := greatest(0, coalesce((p_changes ->> 'freight')::numeric, v_old.freight, 0));
  v_bill_disc := v_subtotal * v_bill_pct / 100;
  v_gst       := v_item_gst * (1 - v_bill_pct / 100);
  v_raw       := v_subtotal - v_bill_disc + v_gst + v_freight;
  v_net       := round(v_raw);

  -- The party: what they owe follows the bill while it is unpaid; business always.
  UPDATE wholesale_customers SET
    total_business      = coalesce(total_business, 0) + (v_net - v_old.net_amount),
    outstanding_balance = coalesce(outstanding_balance, 0)
                          + CASE WHEN v_old.payment_mode = 'credit' AND coalesce(v_old.payment_status, '') <> 'paid'
                                 THEN v_net - v_old.net_amount ELSE 0 END
  WHERE id = v_old.wholesale_customer_id;

  UPDATE wholesale_sales SET
    subtotal        = round(v_subtotal, 2),
    discount_pct    = v_bill_pct,
    discount_amount = round(v_bill_disc, 2),
    freight         = v_freight,
    gst_type        = coalesce(nullif(p_changes ->> 'gst_type', ''), v_old.gst_type),
    gst_amount      = round(v_gst, 2),
    round_off       = round(v_net - v_raw, 2),
    net_amount      = v_net,
    notes           = CASE WHEN p_changes ? 'notes' THEN nullif(trim(p_changes ->> 'notes'), '') ELSE v_old.notes END
  WHERE id = p_id
  RETURNING * INTO v_new;

  DELETE FROM wholesale_sale_items WHERE wholesale_sale_id = p_id;
  INSERT INTO wholesale_sale_items (wholesale_sale_id, product_id, qty, unit_price, mrp, discount_pct, gst_rate, line_total)
  SELECT p_id, (x ->> 'product_id')::uuid, (x ->> 'qty')::int, (x ->> 'unit_price')::numeric, (x ->> 'mrp')::numeric,
         (x ->> 'discount_pct')::numeric, (x ->> 'gst_rate')::numeric, (x ->> 'line_total')::numeric
    FROM jsonb_array_elements(v_new_items) x;

  INSERT INTO bill_edits (bill_type, bill_id, bill_no, reason, before, after)
  VALUES ('wholesale', p_id, v_old.invoice_no, trim(p_reason),
          jsonb_build_object('bill', to_jsonb(v_old), 'items', v_old_items),
          jsonb_build_object('bill', to_jsonb(v_new), 'items', v_new_items));

  RETURN jsonb_build_object('ok', true, 'net_amount', v_net);
END $$;

REVOKE EXECUTE ON FUNCTION public.edit_wholesale(UUID, JSONB, JSONB, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.edit_wholesale(UUID, JSONB, JSONB, TEXT) TO authenticated;
