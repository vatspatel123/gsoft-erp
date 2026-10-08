-- =================================================================================
-- Save a purchase in one trip: bill, new products, restocks and bill lines together.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- Needs PURCHASE_EDIT_FULL.sql (category_for).
-- =================================================================================
-- Purchase Entry used to make one request per item and then download every
-- product again — 10–20 s for a big bill. This does the same work in one
-- transaction: all of it is saved, or none of it (never half a bill).
--
-- p_bill:  purchase_bills columns (purchase_no, supplier_id, supplier_invoice_no, ...)
-- p_items: [{ product_id?, name, design_no, pcode, size, colour, barcode, qty, unit_cost,
--             mrp, unit_price, online_price, wholesale_price, gst_rate, line_total }]
-- Returns { bill, products: [product row per item, in order] }.
CREATE OR REPLACE FUNCTION public.save_purchase(p_bill JSONB, p_items JSONB, p_list_online BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_bill   purchase_bills%ROWTYPE;
  v_prod   products%ROWTYPE;
  v_item   JSONB;
  v_code   TEXT;
  v_clash  TEXT;
  v_prods  JSONB := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one item with qty and cost';
  END IF;

  INSERT INTO purchase_bills (purchase_no, supplier_id, supplier_invoice_no, supplier_invoice_date, subtotal,
                              discount_amount, freight, gst_type, gst_amount, round_off, net_amount,
                              payment_mode, payment_status, notes)
  VALUES (p_bill ->> 'purchase_no', nullif(p_bill ->> 'supplier_id', '')::uuid, nullif(p_bill ->> 'supplier_invoice_no', ''),
          nullif(p_bill ->> 'supplier_invoice_date', '')::date, (p_bill ->> 'subtotal')::numeric,
          (p_bill ->> 'discount_amount')::numeric, (p_bill ->> 'freight')::numeric, p_bill ->> 'gst_type',
          (p_bill ->> 'gst_amount')::numeric, (p_bill ->> 'round_off')::numeric, (p_bill ->> 'net_amount')::numeric,
          p_bill ->> 'payment_mode', p_bill ->> 'payment_status', nullif(p_bill ->> 'notes', ''))
  RETURNING * INTO v_bill;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_code := nullif(trim(coalesce(v_item ->> 'barcode', '')), '');

    IF nullif(v_item ->> 'product_id', '') IS NOT NULL THEN
      -- Restock. An existing product keeps its barcode: its labels are on the shelf.
      UPDATE products SET
        stock_qty  = coalesce(stock_qty, 0) + (v_item ->> 'qty')::int,
        cost_price = (v_item ->> 'unit_cost')::numeric,
        mrp        = coalesce(nullif(v_item ->> 'mrp', '')::numeric, mrp),
        unit_price = coalesce(unit_price, nullif(v_item ->> 'unit_price', '')::numeric),
        barcode    = coalesce(barcode, v_code)
      WHERE id = (v_item ->> 'product_id')::uuid
      RETURNING * INTO v_prod;
      IF NOT FOUND THEN RAISE EXCEPTION 'A product on this bill is no longer in the product list'; END IF;
    ELSE
      IF v_code IS NOT NULL THEN
        SELECT name INTO v_clash FROM products WHERE barcode = v_code LIMIT 1;
        IF FOUND THEN RAISE EXCEPTION 'Barcode % is already used by % — nothing was saved', v_code, v_clash; END IF;
      END IF;
      INSERT INTO products (name, sku, category_id, design_no, pcode, size, colour, cost_price, unit_price, mrp,
                            stock_qty, gst_rate, is_active, is_online, online_price, wholesale_price, barcode)
      VALUES (trim(v_item ->> 'name'), 'SKU-' || coalesce(v_code, ''), category_for(v_item ->> 'name'),
              nullif(v_item ->> 'design_no', ''), nullif(v_item ->> 'pcode', ''), nullif(v_item ->> 'size', ''),
              nullif(v_item ->> 'colour', ''), (v_item ->> 'unit_cost')::numeric, nullif(v_item ->> 'unit_price', '')::numeric,
              nullif(v_item ->> 'mrp', '')::numeric, (v_item ->> 'qty')::int, (v_item ->> 'gst_rate')::numeric, true,
              p_list_online, nullif(v_item ->> 'online_price', '')::numeric, nullif(v_item ->> 'wholesale_price', '')::numeric, v_code)
      RETURNING * INTO v_prod;
    END IF;

    INSERT INTO purchase_items (purchase_id, product_id, product_name, design_no, pcode, size, colour, barcode,
                                qty, unit_cost, mrp, gst_rate, line_total)
    VALUES (v_bill.id, v_prod.id, v_prod.name, nullif(v_item ->> 'design_no', ''), nullif(v_item ->> 'pcode', ''),
            nullif(v_item ->> 'size', ''), nullif(v_item ->> 'colour', ''), v_code, (v_item ->> 'qty')::int,
            (v_item ->> 'unit_cost')::numeric, nullif(v_item ->> 'mrp', '')::numeric, (v_item ->> 'gst_rate')::numeric,
            (v_item ->> 'line_total')::numeric);

    v_prods := v_prods || to_jsonb(v_prod);
  END LOOP;

  RETURN jsonb_build_object('bill', to_jsonb(v_bill), 'products', v_prods);
END $$;

REVOKE EXECUTE ON FUNCTION public.save_purchase(JSONB, JSONB, BOOLEAN) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.save_purchase(JSONB, JSONB, BOOLEAN) TO authenticated;
