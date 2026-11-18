-- Local copy of the shop database (local mode). Built from the cloud structure on 2026-11-18.
-- Regenerate with: pg_dump -n public --schema-only (cloud) when the cloud structure changes.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supabase_auth_admin nologin; create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
create function auth.email() returns text language sql stable as $$ select auth.jwt()->>'email' $$;
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create role supabase_admin nologin;
create role dashboard_user nologin;
grant usage on schema auth to supabase_auth_admin;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.12 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--



--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.12 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--



ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--



--
-- Name: admin_password_ok(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_password_ok(p_password text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM admin_secrets WHERE store_id = auth_store_id())
      THEN EXISTS (SELECT 1 FROM admin_secrets a WHERE a.store_id = auth_store_id()
                    AND a.password_hash = crypt(coalesce(p_password, ''), a.password_hash))
    ELSE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.encrypted_password IS NOT NULL
                    AND u.encrypted_password = crypt(coalesce(p_password, ''), u.encrypted_password))
  END
$$;


ALTER FUNCTION public.admin_password_ok(p_password text) OWNER TO postgres;

--
-- Name: auth_store_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auth_store_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  -- Returns the store_id that belongs to the currently logged in auth.user
  SELECT id FROM public.stores WHERE owner_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION public.auth_store_id() OWNER TO postgres;

--
-- Name: category_for(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.category_for(p_name text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE v_id UUID; v_key TEXT;
BEGIN
  IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN RETURN NULL; END IF;
  v_key := regexp_replace(lower(trim(p_name)), '[^a-z0-9]', '', 'g');
  SELECT id INTO v_id FROM categories
   WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = v_key
   ORDER BY name LIMIT 1;
  IF v_id IS NULL THEN INSERT INTO categories (name) VALUES (trim(p_name)) RETURNING id INTO v_id; END IF;
  RETURN v_id;
END $$;


ALTER FUNCTION public.category_for(p_name text) OWNER TO postgres;

--
-- Name: decrement_stock(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decrement_stock(p_id uuid, qty integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE products
  SET stock_qty = GREATEST(0, stock_qty - qty)
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION public.decrement_stock(p_id uuid, qty integer) OWNER TO postgres;

--
-- Name: delete_exchange(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION public.delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text) OWNER TO postgres;

--
-- Name: delete_purchase(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION public.delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text) OWNER TO postgres;

--
-- Name: delete_sale(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_sale(p_sale_id uuid, p_reason text, p_admin_password text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION public.delete_sale(p_sale_id uuid, p_reason text, p_admin_password text) OWNER TO postgres;

--
-- Name: edit_purchase(uuid, jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION public.edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text) OWNER TO postgres;

--
-- Name: edit_sale(uuid, jsonb, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text DEFAULT NULL::text, p_auth_password text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions'
    AS $$
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
  v_ship         NUMERIC;
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
  v_ship := greatest(0, coalesce((p_changes ->> 'shipping_amount')::numeric, v_old.shipping_amount, 0));
  v_net := round(v_subtotal - v_discount + v_ship, 2);

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
    shipping_amount = v_ship,
    note            = CASE WHEN p_changes ? 'note' THEN nullif(trim(p_changes ->> 'note'), '') ELSE note END,
    alteration_qty  = CASE WHEN p_changes ? 'alteration_qty'
                           THEN greatest(0, coalesce(nullif(p_changes ->> 'alteration_qty', '')::int, 0)) ELSE alteration_qty END,
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


ALTER FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text, p_auth_password text) OWNER TO postgres;

--
-- Name: edit_wholesale(uuid, jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text) OWNER TO postgres;

--
-- Name: record_wholesale_payment(uuid, numeric, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text) OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: save_purchase(jsonb, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


ALTER FUNCTION public.save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean) OWNER TO postgres;

--
-- Name: set_admin_password(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_admin_password(p_current text, p_new text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  IF auth_store_id() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT admin_password_ok(p_current) THEN RAISE EXCEPTION 'Current password is wrong'; END IF;
  IF length(coalesce(p_new, '')) < 4 THEN RAISE EXCEPTION 'The new password needs at least 4 characters'; END IF;
  INSERT INTO admin_secrets (store_id, password_hash, updated_at)
  VALUES (auth_store_id(), crypt(p_new, gen_salt('bf')), now())
  ON CONFLICT (store_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = now();
END $$;


ALTER FUNCTION public.set_admin_password(p_current text, p_new text) OWNER TO postgres;

--
-- Name: set_staff_password(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text DEFAULT NULL::text, p_owner_password text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION public.set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text, p_owner_password text) OWNER TO postgres;

--
-- Name: set_store_id_from_auth(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_store_id_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.store_id IS NULL THEN
    NEW.store_id := auth_store_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_store_id_from_auth() OWNER TO postgres;

--
-- Name: staff_with_password(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.staff_with_password() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.user_id FROM staff_credentials c JOIN users u ON u.id = c.user_id
   WHERE u.store_id = auth_store_id()
$$;


ALTER FUNCTION public.staff_with_password() OWNER TO postgres;

--
-- Name: verify_staff_password(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.verify_staff_password(p_login text, p_password text) RETURNS TABLE(id uuid, name text, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT u.id, u.name::text, u.role::text
    FROM users u JOIN staff_credentials c ON c.user_id = u.id
   WHERE u.store_id = auth_store_id()
     AND u.is_active IS NOT FALSE
     AND lower(u.email) = lower(trim(p_login))
     AND c.password_hash = crypt(p_password, c.password_hash)
$$;


ALTER FUNCTION public.verify_staff_password(p_login text, p_password text) OWNER TO postgres;

--
-- Name: wholesale_edit_keeps_due(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.wholesale_edit_keeps_due() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.net_amount IS DISTINCT FROM OLD.net_amount
     AND OLD.payment_mode = 'credit' AND coalesce(OLD.payment_status, '') <> 'paid' THEN
    NEW.credit_amount := greatest(OLD.credit_paid, OLD.credit_amount + (NEW.net_amount - OLD.net_amount));
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.wholesale_edit_keeps_due() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_secrets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_secrets (
    store_id uuid NOT NULL,
    password_hash text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_secrets OWNER TO postgres;

--
-- Name: bill_edits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bill_edits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    bill_type text NOT NULL,
    bill_id uuid NOT NULL,
    bill_no text,
    reason text NOT NULL,
    authorized_by uuid,
    authorized_name text,
    edited_by_login text DEFAULT (auth.jwt() ->> 'email'::text),
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bill_edits_bill_type_check CHECK ((bill_type = ANY (ARRAY['sale'::text, 'purchase'::text, 'exchange'::text, 'wholesale'::text]))),
    CONSTRAINT bill_edits_reason_check CHECK ((length(TRIM(BOTH FROM reason)) >= 3))
);


ALTER TABLE public.bill_edits OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    parent_id uuid,
    hsn_code text
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(20) NOT NULL,
    parent_id uuid,
    is_active boolean DEFAULT true,
    CONSTRAINT chart_of_accounts_type_check CHECK (((type)::text = ANY ((ARRAY['asset'::character varying, 'liability'::character varying, 'income'::character varying, 'expense'::character varying, 'equity'::character varying])::text[])))
);


ALTER TABLE public.chart_of_accounts OWNER TO postgres;

--
-- Name: counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    location character varying(100),
    is_active boolean DEFAULT true
);


ALTER TABLE public.counters OWNER TO postgres;

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(20) NOT NULL,
    value numeric(10,2) NOT NULL,
    min_order_value numeric(10,2) DEFAULT 0,
    max_discount_cap numeric(10,2),
    max_uses integer,
    used_count integer DEFAULT 0,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    is_active boolean DEFAULT true,
    CONSTRAINT coupons_type_check CHECK (((type)::text = ANY ((ARRAY['flat'::character varying, 'percentage'::character varying, 'gift'::character varying])::text[])))
);


ALTER TABLE public.coupons OWNER TO postgres;

--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    credit_note_no text NOT NULL,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    original_sale_id uuid,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    balance_amount numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text,
    notes text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'redeemed'::text, 'expired'::text, 'cancelled'::text])))
);


ALTER TABLE public.credit_notes OWNER TO postgres;

--
-- Name: customer_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    sale_id uuid,
    exchange_id uuid,
    customer_id uuid,
    amount numeric(10,2) NOT NULL,
    tender text DEFAULT 'cash'::text NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_payments_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.customer_payments OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(150),
    gstin character varying(20),
    loyalty_points integer DEFAULT 0,
    total_spent numeric(14,2) DEFAULT 0,
    referral_code character varying(20) DEFAULT "substring"((gen_random_uuid())::text, 1, 8) NOT NULL,
    referred_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    date_of_birth date,
    address text,
    notes text,
    store_id uuid NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: exchange_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exchange_no character varying(50) NOT NULL,
    original_sale_id uuid,
    original_invoice_no character varying(50),
    customer_id uuid,
    salesman_id uuid,
    return_amount numeric(10,2) DEFAULT 0,
    new_sale_amount numeric(10,2) DEFAULT 0,
    balance_amount numeric(10,2) DEFAULT 0,
    balance_type character varying(20) DEFAULT 'nil'::character varying,
    payment_mode character varying(20) DEFAULT 'cash'::character varying,
    notes text,
    status character varying(20) DEFAULT 'completed'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    store_id uuid NOT NULL,
    cash_amount numeric(10,2) DEFAULT 0 NOT NULL,
    card_amount numeric(10,2) DEFAULT 0 NOT NULL,
    upi_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credit_paid numeric(10,2) DEFAULT 0 NOT NULL,
    credit_status text DEFAULT 'paid'::text NOT NULL,
    credit_due_date date,
    credit_tender text,
    refund_mode text,
    credit_note_id uuid,
    CONSTRAINT exchange_bills_credit_status_check CHECK ((credit_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text])))
);


ALTER TABLE public.exchange_bills OWNER TO postgres;

--
-- Name: exchange_new_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_new_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exchange_id uuid,
    product_id uuid,
    qty integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    store_id uuid NOT NULL
);


ALTER TABLE public.exchange_new_items OWNER TO postgres;

--
-- Name: exchange_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exchange_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exchange_id uuid,
    product_id uuid,
    qty integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    reason character varying(100) DEFAULT 'exchange'::character varying,
    store_id uuid NOT NULL
);


ALTER TABLE public.exchange_return_items OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_no character varying(50) NOT NULL,
    category character varying(50) NOT NULL,
    subcategory character varying(50),
    description text,
    amount numeric(10,2) NOT NULL,
    payment_mode character varying(20) DEFAULT 'cash'::character varying,
    paid_to character varying(100),
    reference_no character varying(50),
    expense_date date DEFAULT CURRENT_DATE,
    month character varying(7),
    receipt_notes text,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: gst_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gst_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ref_type character varying(20) NOT NULL,
    ref_id uuid NOT NULL,
    invoice_no character varying(50) NOT NULL,
    party_gstin character varying(20),
    taxable_value numeric(12,2) NOT NULL,
    cgst numeric(10,2) DEFAULT 0,
    sgst numeric(10,2) DEFAULT 0,
    igst numeric(10,2) DEFAULT 0,
    total_gst numeric(10,2) NOT NULL,
    irn_no character varying(100),
    eway_bill_no character varying(50),
    irn_status character varying(20) DEFAULT 'pending'::character varying,
    entry_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gst_entries OWNER TO postgres;

--
-- Name: inward_challan_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inward_challan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    inward_challan_id uuid,
    purchase_order_item_id uuid,
    product_id uuid,
    product_name text,
    design_no text,
    size text,
    colour text,
    batch_no text,
    qty_received integer DEFAULT 0 NOT NULL,
    qty_damaged integer DEFAULT 0 NOT NULL,
    unit_cost numeric(10,2) DEFAULT 0 NOT NULL,
    line_total numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.inward_challan_items OWNER TO postgres;

--
-- Name: inward_challans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inward_challans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challan_no character varying(50) NOT NULL,
    supplier_id uuid,
    po_id uuid,
    is_return boolean DEFAULT false,
    total_qty integer NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    store_id uuid,
    challan_date date DEFAULT CURRENT_DATE,
    purchase_order_id uuid,
    purchase_bill_id uuid,
    received_by text,
    notes text,
    bill_amount numeric(10,2) DEFAULT 0
);


ALTER TABLE public.inward_challans OWNER TO postgres;

--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    entry_type character varying(6) NOT NULL,
    amount numeric(12,2) NOT NULL,
    narration text,
    ref_type character varying(30),
    ref_id uuid,
    entry_date date NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ledger_entries_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT ledger_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
);


ALTER TABLE public.ledger_entries OWNER TO postgres;

--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    sale_id uuid,
    type character varying(20) NOT NULL,
    points_delta integer NOT NULL,
    balance_after integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT loyalty_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['earn'::character varying, 'redeem'::character varying, 'bonus'::character varying, 'referral'::character varying])::text[])))
);


ALTER TABLE public.loyalty_transactions OWNER TO postgres;

--
-- Name: online_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    shipping_address text,
    city text,
    state text,
    pincode text,
    total_amount numeric DEFAULT 0 NOT NULL,
    discount_amount numeric DEFAULT 0 NOT NULL,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    net_amount numeric DEFAULT 0 NOT NULL,
    payment_method text DEFAULT 'cod'::text NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    order_status text DEFAULT 'new'::text NOT NULL,
    tracking_number text,
    tracking_courier text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT online_orders_order_status_check CHECK ((order_status = ANY (ARRAY['new'::text, 'confirmed'::text, 'packed'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text]))),
    CONSTRAINT online_orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cod'::text, 'online'::text, 'upi'::text, 'whatsapp'::text]))),
    CONSTRAINT online_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'refunded'::text])))
);


ALTER TABLE public.online_orders OWNER TO postgres;

--
-- Name: physical_stock_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.physical_stock_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    system_qty integer NOT NULL,
    physical_qty integer NOT NULL,
    notes text,
    counted_by uuid,
    counted_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.physical_stock_counts OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    sku character varying(80) NOT NULL,
    barcode character varying(100),
    serial_barcode character varying(100),
    category_id uuid,
    supplier_id uuid,
    unit_price numeric(10,2) NOT NULL,
    cost_price numeric(10,2),
    gst_rate numeric(5,2) DEFAULT 18,
    photo_url text,
    stock_qty integer DEFAULT 0,
    low_stock_alert integer DEFAULT 5,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    design_no character varying(50),
    pcode character varying(50),
    size character varying(20),
    colour character varying(50),
    mrp numeric(10,2),
    batch_no character varying(50),
    hsn_code character varying(20),
    brand character varying(100),
    store_id uuid NOT NULL,
    is_online boolean DEFAULT false,
    online_price numeric,
    online_discount_pct numeric DEFAULT 0,
    online_title text,
    online_description text,
    online_category text,
    is_featured boolean DEFAULT false,
    is_bestseller boolean DEFAULT false,
    tags text,
    photos text[] DEFAULT '{}'::text[],
    wholesale_price numeric(10,2)
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: promo_offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promo_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(100) NOT NULL,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    applies_to character varying(20) NOT NULL,
    target_id uuid,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    CONSTRAINT promo_offers_applies_to_check CHECK (((applies_to)::text = ANY ((ARRAY['all'::character varying, 'category'::character varying, 'product'::character varying])::text[]))),
    CONSTRAINT promo_offers_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['flat'::character varying, 'percentage'::character varying, 'bogo'::character varying, 'free_gift'::character varying])::text[])))
);


ALTER TABLE public.promo_offers OWNER TO postgres;

--
-- Name: purchase_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_no character varying(50) NOT NULL,
    supplier_id uuid,
    supplier_invoice_no character varying(50),
    supplier_invoice_date date,
    subtotal numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    freight numeric(10,2) DEFAULT 0,
    gst_type character varying(10) DEFAULT 'gst'::character varying,
    gst_amount numeric(10,2) DEFAULT 0,
    round_off numeric(5,2) DEFAULT 0,
    net_amount numeric(10,2) DEFAULT 0,
    payment_mode character varying(20) DEFAULT 'credit'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    payment_tender text,
    edited_at timestamp with time zone,
    edit_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.purchase_bills OWNER TO postgres;

--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid,
    product_id uuid,
    product_name character varying(100),
    design_no character varying(50),
    pcode character varying(50),
    size character varying(20),
    colour character varying(50),
    batch_no character varying(50),
    qty integer NOT NULL,
    unit_cost numeric(10,2) NOT NULL,
    mrp numeric(10,2),
    gst_rate numeric(5,2) DEFAULT 0,
    line_total numeric(10,2) NOT NULL,
    barcode text
);


ALTER TABLE public.purchase_items OWNER TO postgres;

--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    purchase_order_id uuid,
    product_id uuid,
    product_name text,
    design_no text,
    size text,
    colour text,
    qty_ordered integer DEFAULT 0 NOT NULL,
    qty_received integer DEFAULT 0 NOT NULL,
    unit_cost numeric(10,2) DEFAULT 0 NOT NULL,
    line_total numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_no character varying(50) NOT NULL,
    supplier_id uuid NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    gst_amount numeric(10,2) DEFAULT 0,
    net_payable numeric(12,2) NOT NULL,
    is_debit_note boolean DEFAULT false,
    ref_po_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    store_id uuid,
    order_date date DEFAULT CURRENT_DATE,
    expected_date date,
    subtotal numeric(10,2) DEFAULT 0,
    net_amount numeric(10,2) DEFAULT 0,
    notes text
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchase_return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    purchase_return_id uuid,
    product_id uuid,
    product_name text,
    sku text,
    barcode text,
    size text,
    colour text,
    qty integer DEFAULT 1 NOT NULL,
    unit_cost numeric(10,2) DEFAULT 0 NOT NULL,
    line_total numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.purchase_return_items OWNER TO postgres;

--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    return_no text NOT NULL,
    supplier_id uuid,
    supplier_name text,
    supplier_phone text,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'completed'::text,
    reason text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT purchase_returns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.purchase_returns OWNER TO postgres;

--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    barcode character varying(100) NOT NULL,
    qty integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount_pct numeric(5,2) DEFAULT 0,
    gst_rate numeric(5,2) DEFAULT 18,
    line_total numeric(12,2) NOT NULL,
    store_id uuid NOT NULL,
    CONSTRAINT sale_items_qty_check CHECK ((qty > 0))
);


ALTER TABLE public.sale_items OWNER TO postgres;

--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no character varying(50) NOT NULL,
    customer_id uuid,
    salesman_id uuid,
    counter_id uuid,
    total_amount numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0,
    coupon_code character varying(50),
    net_amount numeric(12,2) NOT NULL,
    gst_amount numeric(10,2) DEFAULT 0,
    payment_mode character varying(20) DEFAULT 'cash'::character varying NOT NULL,
    loyalty_points_used integer DEFAULT 0,
    is_return boolean DEFAULT false,
    return_ref_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    store_id uuid NOT NULL,
    credit_due_days integer,
    credit_due_date date,
    credit_status text DEFAULT 'paid'::text,
    cash_amount numeric(10,2) DEFAULT 0 NOT NULL,
    card_amount numeric(10,2) DEFAULT 0 NOT NULL,
    upi_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credit_paid numeric(10,2) DEFAULT 0 NOT NULL,
    credit_tender text,
    edited_at timestamp with time zone,
    edit_count integer DEFAULT 0 NOT NULL,
    note text,
    alteration_qty integer DEFAULT 0 NOT NULL,
    shipping_amount numeric DEFAULT 0 NOT NULL,
    CONSTRAINT sales_alteration_qty_check CHECK ((alteration_qty >= 0)),
    CONSTRAINT sales_credit_status_check CHECK ((credit_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text]))),
    CONSTRAINT sales_payment_mode_check CHECK (((payment_mode)::text = ANY ((ARRAY['cash'::character varying, 'card'::character varying, 'upi'::character varying, 'credit'::character varying])::text[]))),
    CONSTRAINT sales_shipping_amount_check CHECK ((shipping_amount >= (0)::numeric))
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: staff_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_credentials (
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_credentials OWNER TO postgres;

--
-- Name: stock_damage_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_damage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    qty integer NOT NULL,
    type character varying(20) DEFAULT 'damage'::character varying,
    reason text,
    logged_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    qty_before integer DEFAULT 0,
    qty_after integer DEFAULT 0,
    adjustment_type character varying(20) DEFAULT 'remove'::character varying,
    notes text,
    store_id uuid NOT NULL,
    CONSTRAINT stock_damage_log_qty_check CHECK ((qty > 0)),
    CONSTRAINT stock_damage_log_type_check CHECK (((type)::text = ANY ((ARRAY['damage'::character varying, 'loss'::character varying, 'theft'::character varying, 'expiry'::character varying])::text[])))
);


ALTER TABLE public.stock_damage_log OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid,
    subscription_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    opening_cash numeric(12,2) DEFAULT 0 NOT NULL,
    opening_bank numeric(12,2) DEFAULT 0 NOT NULL,
    settings jsonb,
    CONSTRAINT stores_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'locked'::text, 'past_due'::text, 'trialing'::text])))
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    gstin character varying(20),
    phone character varying(20),
    email character varying(150),
    address text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    role character varying(30) DEFAULT 'cashier'::character varying NOT NULL,
    counter_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    pin character varying(4) DEFAULT '1234'::character varying,
    monthly_salary numeric(10,2) DEFAULT 0,
    salary_paid_date date,
    store_id uuid NOT NULL,
    commission_pct numeric DEFAULT 0 NOT NULL,
    CONSTRAINT users_commission_pct_check CHECK (((commission_pct >= (0)::numeric) AND (commission_pct <= (100)::numeric)))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: website_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.website_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_name text DEFAULT 'GSoft Retail Store'::text NOT NULL,
    tagline text DEFAULT ''::text,
    logo_url text,
    hero_title text DEFAULT ''::text,
    hero_subtitle text DEFAULT ''::text,
    hero_banner_url text,
    hero_banners text[] DEFAULT '{}'::text[],
    announcement_bar text DEFAULT ''::text,
    show_announcement boolean DEFAULT true,
    whatsapp_number text DEFAULT ''::text,
    enable_whatsapp_checkout boolean DEFAULT true,
    enable_cod boolean DEFAULT true,
    min_order_free_shipping numeric DEFAULT 999,
    standard_delivery_fee numeric DEFAULT 70,
    theme_color text DEFAULT '#9333ea'::text,
    instagram_url text,
    facebook_url text,
    contact_address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.website_settings OWNER TO postgres;

--
-- Name: wholesale_customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wholesale_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    email character varying(100),
    gstin character varying(15),
    business_name character varying(100),
    address text,
    state character varying(50) DEFAULT 'Gujarat'::character varying,
    city character varying(50),
    credit_limit numeric(10,2) DEFAULT 0,
    outstanding_balance numeric(10,2) DEFAULT 0,
    total_business numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    pincode text
);


ALTER TABLE public.wholesale_customers OWNER TO postgres;

--
-- Name: wholesale_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wholesale_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wholesale_customer_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    tender text NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    settled jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wholesale_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT wholesale_payments_tender_check CHECK ((tender = ANY (ARRAY['cash'::text, 'upi'::text, 'card'::text, 'cheque'::text])))
);


ALTER TABLE public.wholesale_payments OWNER TO postgres;

--
-- Name: wholesale_sale_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wholesale_sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wholesale_sale_id uuid,
    product_id uuid,
    qty integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    mrp numeric(10,2),
    discount_pct numeric(5,2) DEFAULT 0,
    gst_rate numeric(5,2) DEFAULT 0,
    line_total numeric(10,2) NOT NULL
);


ALTER TABLE public.wholesale_sale_items OWNER TO postgres;

--
-- Name: wholesale_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wholesale_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no character varying(50) NOT NULL,
    wholesale_customer_id uuid,
    salesman_id uuid,
    subtotal numeric(10,2) DEFAULT 0,
    discount_pct numeric(5,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    freight numeric(10,2) DEFAULT 0,
    gst_type character varying(10) DEFAULT 'gst'::character varying,
    gst_amount numeric(10,2) DEFAULT 0,
    round_off numeric(5,2) DEFAULT 0,
    net_amount numeric(10,2) DEFAULT 0,
    payment_mode character varying(20) DEFAULT 'credit'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    cash_amount numeric(12,2) DEFAULT 0 NOT NULL,
    upi_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cheque_amount numeric(12,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    credit_paid numeric(12,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.wholesale_sales OWNER TO postgres;

--
-- Name: admin_secrets admin_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_secrets
    ADD CONSTRAINT admin_secrets_pkey PRIMARY KEY (store_id);


--
-- Name: bill_edits bill_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_edits
    ADD CONSTRAINT bill_edits_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_code_key UNIQUE (code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: counters counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counters
    ADD CONSTRAINT counters_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_payments customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_referral_code_key UNIQUE (referral_code);


--
-- Name: exchange_bills exchange_bills_exchange_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_exchange_no_key UNIQUE (exchange_no);


--
-- Name: exchange_bills exchange_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_pkey PRIMARY KEY (id);


--
-- Name: exchange_new_items exchange_new_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_new_items
    ADD CONSTRAINT exchange_new_items_pkey PRIMARY KEY (id);


--
-- Name: exchange_return_items exchange_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_return_items
    ADD CONSTRAINT exchange_return_items_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_expense_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_expense_no_key UNIQUE (expense_no);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: gst_entries gst_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_entries
    ADD CONSTRAINT gst_entries_pkey PRIMARY KEY (id);


--
-- Name: inward_challan_items inward_challan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challan_items
    ADD CONSTRAINT inward_challan_items_pkey PRIMARY KEY (id);


--
-- Name: inward_challans inward_challans_challan_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_challan_no_key UNIQUE (challan_no);


--
-- Name: inward_challans inward_challans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: online_orders online_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_order_no_key UNIQUE (order_no);


--
-- Name: online_orders online_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_pkey PRIMARY KEY (id);


--
-- Name: physical_stock_counts physical_stock_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_stock_counts
    ADD CONSTRAINT physical_stock_counts_pkey PRIMARY KEY (id);


--
-- Name: products products_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_barcode_key UNIQUE (barcode);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_serial_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_serial_barcode_key UNIQUE (serial_barcode);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: promo_offers promo_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promo_offers
    ADD CONSTRAINT promo_offers_pkey PRIMARY KEY (id);


--
-- Name: purchase_bills purchase_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_bills
    ADD CONSTRAINT purchase_bills_pkey PRIMARY KEY (id);


--
-- Name: purchase_bills purchase_bills_purchase_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_bills
    ADD CONSTRAINT purchase_bills_purchase_no_key UNIQUE (purchase_no);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_no_key UNIQUE (po_no);


--
-- Name: purchase_return_items purchase_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_invoice_no_key UNIQUE (invoice_no);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: staff_credentials staff_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_credentials
    ADD CONSTRAINT staff_credentials_pkey PRIMARY KEY (user_id);


--
-- Name: stock_damage_log stock_damage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_damage_log
    ADD CONSTRAINT stock_damage_log_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: website_settings website_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.website_settings
    ADD CONSTRAINT website_settings_pkey PRIMARY KEY (id);


--
-- Name: wholesale_customers wholesale_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_customers
    ADD CONSTRAINT wholesale_customers_pkey PRIMARY KEY (id);


--
-- Name: wholesale_payments wholesale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_payments
    ADD CONSTRAINT wholesale_payments_pkey PRIMARY KEY (id);


--
-- Name: wholesale_sale_items wholesale_sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sale_items
    ADD CONSTRAINT wholesale_sale_items_pkey PRIMARY KEY (id);


--
-- Name: wholesale_sales wholesale_sales_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sales
    ADD CONSTRAINT wholesale_sales_invoice_no_key UNIQUE (invoice_no);


--
-- Name: wholesale_sales wholesale_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sales
    ADD CONSTRAINT wholesale_sales_pkey PRIMARY KEY (id);


--
-- Name: idx_bill_edits_bill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bill_edits_bill ON public.bill_edits USING btree (bill_type, bill_id, created_at DESC);


--
-- Name: idx_challan_items_challan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_challan_items_challan ON public.inward_challan_items USING btree (inward_challan_id);


--
-- Name: idx_challan_po; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_challan_po ON public.inward_challans USING btree (purchase_order_id);


--
-- Name: idx_customer_payments_paid_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_payments_paid_at ON public.customer_payments USING btree (paid_at DESC);


--
-- Name: idx_exchange_bills_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_bills_created_at ON public.exchange_bills USING btree (created_at DESC);


--
-- Name: idx_exchange_bills_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_bills_customer_id ON public.exchange_bills USING btree (customer_id);


--
-- Name: idx_exchange_bills_original_sale_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_bills_original_sale_id ON public.exchange_bills USING btree (original_sale_id);


--
-- Name: idx_exchange_bills_salesman_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_bills_salesman_id ON public.exchange_bills USING btree (salesman_id);


--
-- Name: idx_exchange_new_items_exchange_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_new_items_exchange_id ON public.exchange_new_items USING btree (exchange_id);


--
-- Name: idx_exchange_return_items_exchange_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exchange_return_items_exchange_id ON public.exchange_return_items USING btree (exchange_id);


--
-- Name: idx_online_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_online_orders_created_at ON public.online_orders USING btree (created_at DESC);


--
-- Name: idx_online_orders_order_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_online_orders_order_no ON public.online_orders USING btree (order_no);


--
-- Name: idx_po_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_po_items_order ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_po_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_po_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_po_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_po_supplier ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_is_online; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_is_online ON public.products USING btree (is_online) WHERE (is_online = true);


--
-- Name: idx_sales_cash_amount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_cash_amount ON public.sales USING btree (created_at) WHERE (cash_amount > (0)::numeric);


--
-- Name: idx_sales_credit_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_credit_status ON public.sales USING btree (credit_status) WHERE (credit_status <> 'paid'::text);


--
-- Name: idx_wholesale_payments_paid_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wholesale_payments_paid_at ON public.wholesale_payments USING btree (paid_at);


--
-- Name: idx_wholesale_payments_party; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wholesale_payments_party ON public.wholesale_payments USING btree (wholesale_customer_id, paid_at DESC);


--
-- Name: bill_edits set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.bill_edits FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: credit_notes set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: customer_payments set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: customers set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: exchange_bills set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.exchange_bills FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: exchange_new_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.exchange_new_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: exchange_return_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.exchange_return_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: inward_challan_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.inward_challan_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: inward_challans set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.inward_challans FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: products set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: purchase_order_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: purchase_orders set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: purchase_return_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.purchase_return_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: purchase_returns set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.purchase_returns FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: sale_items set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: sales set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: stock_damage_log set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.stock_damage_log FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: users set_store_id_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_store_id_from_auth();


--
-- Name: wholesale_sales trg_wholesale_edit_keeps_due; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wholesale_edit_keeps_due BEFORE UPDATE OF net_amount ON public.wholesale_sales FOR EACH ROW EXECUTE FUNCTION public.wholesale_edit_keeps_due();


--
-- Name: admin_secrets admin_secrets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_secrets
    ADD CONSTRAINT admin_secrets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: bill_edits bill_edits_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_edits
    ADD CONSTRAINT bill_edits_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bill_edits bill_edits_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bill_edits
    ADD CONSTRAINT bill_edits_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id);


--
-- Name: chart_of_accounts chart_of_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: credit_notes credit_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: credit_notes credit_notes_original_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_original_sale_id_fkey FOREIGN KEY (original_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: credit_notes credit_notes_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: customer_payments customer_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customer_payments customer_payments_exchange_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_exchange_id_fkey FOREIGN KEY (exchange_id) REFERENCES public.exchange_bills(id) ON DELETE CASCADE;


--
-- Name: customer_payments customer_payments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: customer_payments customer_payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: customers customers_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.customers(id);


--
-- Name: customers customers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: exchange_bills exchange_bills_credit_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id) ON DELETE SET NULL;


--
-- Name: exchange_bills exchange_bills_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: exchange_bills exchange_bills_original_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_original_sale_id_fkey FOREIGN KEY (original_sale_id) REFERENCES public.sales(id);


--
-- Name: exchange_bills exchange_bills_salesman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_salesman_id_fkey FOREIGN KEY (salesman_id) REFERENCES public.users(id);


--
-- Name: exchange_bills exchange_bills_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_bills
    ADD CONSTRAINT exchange_bills_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: exchange_new_items exchange_new_items_exchange_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_new_items
    ADD CONSTRAINT exchange_new_items_exchange_id_fkey FOREIGN KEY (exchange_id) REFERENCES public.exchange_bills(id);


--
-- Name: exchange_new_items exchange_new_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_new_items
    ADD CONSTRAINT exchange_new_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: exchange_new_items exchange_new_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_new_items
    ADD CONSTRAINT exchange_new_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: exchange_return_items exchange_return_items_exchange_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_return_items
    ADD CONSTRAINT exchange_return_items_exchange_id_fkey FOREIGN KEY (exchange_id) REFERENCES public.exchange_bills(id);


--
-- Name: exchange_return_items exchange_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_return_items
    ADD CONSTRAINT exchange_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: exchange_return_items exchange_return_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exchange_return_items
    ADD CONSTRAINT exchange_return_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: expenses expenses_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: inward_challan_items inward_challan_items_inward_challan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challan_items
    ADD CONSTRAINT inward_challan_items_inward_challan_id_fkey FOREIGN KEY (inward_challan_id) REFERENCES public.inward_challans(id) ON DELETE CASCADE;


--
-- Name: inward_challan_items inward_challan_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challan_items
    ADD CONSTRAINT inward_challan_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: inward_challan_items inward_challan_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challan_items
    ADD CONSTRAINT inward_challan_items_purchase_order_item_id_fkey FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;


--
-- Name: inward_challan_items inward_challan_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challan_items
    ADD CONSTRAINT inward_challan_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: inward_challans inward_challans_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);


--
-- Name: inward_challans inward_challans_purchase_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_purchase_bill_id_fkey FOREIGN KEY (purchase_bill_id) REFERENCES public.purchase_bills(id) ON DELETE SET NULL;


--
-- Name: inward_challans inward_challans_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: inward_challans inward_challans_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: inward_challans inward_challans_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inward_challans
    ADD CONSTRAINT inward_challans_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: ledger_entries ledger_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: ledger_entries ledger_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: loyalty_transactions loyalty_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: loyalty_transactions loyalty_transactions_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: physical_stock_counts physical_stock_counts_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_stock_counts
    ADD CONSTRAINT physical_stock_counts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES public.users(id);


--
-- Name: physical_stock_counts physical_stock_counts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_stock_counts
    ADD CONSTRAINT physical_stock_counts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_bills purchase_bills_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_bills
    ADD CONSTRAINT purchase_bills_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase_bills(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_orders purchase_orders_ref_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_ref_po_id_fkey FOREIGN KEY (ref_po_id) REFERENCES public.purchase_orders(id);


--
-- Name: purchase_orders purchase_orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_return_items purchase_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: purchase_return_items purchase_return_items_purchase_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_purchase_return_id_fkey FOREIGN KEY (purchase_return_id) REFERENCES public.purchase_returns(id) ON DELETE CASCADE;


--
-- Name: purchase_return_items purchase_return_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_return_items
    ADD CONSTRAINT purchase_return_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_returns purchase_returns_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_returns purchase_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: sales sales_counter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id);


--
-- Name: sales sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales sales_return_ref_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_return_ref_id_fkey FOREIGN KEY (return_ref_id) REFERENCES public.sales(id);


--
-- Name: sales sales_salesman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_salesman_id_fkey FOREIGN KEY (salesman_id) REFERENCES public.users(id);


--
-- Name: sales sales_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: staff_credentials staff_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_credentials
    ADD CONSTRAINT staff_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_damage_log stock_damage_log_logged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_damage_log
    ADD CONSTRAINT stock_damage_log_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES public.users(id);


--
-- Name: stock_damage_log stock_damage_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_damage_log
    ADD CONSTRAINT stock_damage_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_damage_log stock_damage_log_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_damage_log
    ADD CONSTRAINT stock_damage_log_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: users users_counter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id);


--
-- Name: users users_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: wholesale_payments wholesale_payments_wholesale_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_payments
    ADD CONSTRAINT wholesale_payments_wholesale_customer_id_fkey FOREIGN KEY (wholesale_customer_id) REFERENCES public.wholesale_customers(id);


--
-- Name: wholesale_sale_items wholesale_sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sale_items
    ADD CONSTRAINT wholesale_sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: wholesale_sale_items wholesale_sale_items_wholesale_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sale_items
    ADD CONSTRAINT wholesale_sale_items_wholesale_sale_id_fkey FOREIGN KEY (wholesale_sale_id) REFERENCES public.wholesale_sales(id);


--
-- Name: wholesale_sales wholesale_sales_salesman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sales
    ADD CONSTRAINT wholesale_sales_salesman_id_fkey FOREIGN KEY (salesman_id) REFERENCES public.users(id);


--
-- Name: wholesale_sales wholesale_sales_wholesale_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wholesale_sales
    ADD CONSTRAINT wholesale_sales_wholesale_customer_id_fkey FOREIGN KEY (wholesale_customer_id) REFERENCES public.wholesale_customers(id);


--
-- Name: stores Store Owner Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Store Owner Policy" ON public.stores USING ((owner_id = auth.uid()));


--
-- Name: credit_notes Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.credit_notes USING ((store_id = public.auth_store_id()));


--
-- Name: customers Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.customers USING ((store_id = public.auth_store_id()));


--
-- Name: exchange_bills Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.exchange_bills USING ((store_id = public.auth_store_id()));


--
-- Name: exchange_new_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.exchange_new_items USING ((store_id = public.auth_store_id()));


--
-- Name: exchange_return_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.exchange_return_items USING ((store_id = public.auth_store_id()));


--
-- Name: inward_challan_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.inward_challan_items USING ((store_id = public.auth_store_id()));


--
-- Name: inward_challans Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.inward_challans USING ((store_id = public.auth_store_id()));


--
-- Name: products Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.products USING ((store_id = public.auth_store_id()));


--
-- Name: purchase_order_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.purchase_order_items USING ((store_id = public.auth_store_id()));


--
-- Name: purchase_orders Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.purchase_orders USING ((store_id = public.auth_store_id()));


--
-- Name: purchase_return_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.purchase_return_items USING ((store_id = public.auth_store_id()));


--
-- Name: purchase_returns Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.purchase_returns USING ((store_id = public.auth_store_id()));


--
-- Name: sale_items Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.sale_items USING ((store_id = public.auth_store_id()));


--
-- Name: sales Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.sales USING ((store_id = public.auth_store_id()));


--
-- Name: stock_damage_log Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.stock_damage_log USING ((store_id = public.auth_store_id()));


--
-- Name: users Tenant Isolation Policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant Isolation Policy" ON public.users USING ((store_id = public.auth_store_id()));


--
-- Name: admin_secrets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: categories allow_all_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_categories ON public.categories USING (true) WITH CHECK (true);


--
-- Name: customers allow_all_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_customers ON public.customers USING (true) WITH CHECK (true);


--
-- Name: stock_damage_log allow_all_damage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_damage ON public.stock_damage_log USING (true) WITH CHECK (true);


--
-- Name: exchange_bills allow_all_exchange_bills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_exchange_bills ON public.exchange_bills USING (true) WITH CHECK (true);


--
-- Name: exchange_new_items allow_all_exchange_new_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_exchange_new_items ON public.exchange_new_items USING (true) WITH CHECK (true);


--
-- Name: exchange_return_items allow_all_exchange_return_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_exchange_return_items ON public.exchange_return_items USING (true) WITH CHECK (true);


--
-- Name: gst_entries allow_all_gst; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_gst ON public.gst_entries USING (true) WITH CHECK (true);


--
-- Name: sale_items allow_all_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_items ON public.sale_items USING (true) WITH CHECK (true);


--
-- Name: loyalty_transactions allow_all_loyalty; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_loyalty ON public.loyalty_transactions USING (true) WITH CHECK (true);


--
-- Name: online_orders allow_all_online_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_online_orders ON public.online_orders USING (true) WITH CHECK (true);


--
-- Name: products allow_all_products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_products ON public.products USING (true) WITH CHECK (true);


--
-- Name: sales allow_all_sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_sales ON public.sales USING (true) WITH CHECK (true);


--
-- Name: physical_stock_counts allow_all_stock_counts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_stock_counts ON public.physical_stock_counts USING (true) WITH CHECK (true);


--
-- Name: users allow_all_users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_users ON public.users USING (true) WITH CHECK (true);


--
-- Name: website_settings allow_all_website_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_website_settings ON public.website_settings USING (true) WITH CHECK (true);


--
-- Name: wholesale_payments allow_all_wholesale_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_all_wholesale_payments ON public.wholesale_payments USING (true) WITH CHECK (true);


--
-- Name: exchange_bills allow_exchange_bills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_exchange_bills ON public.exchange_bills USING (true) WITH CHECK (true);


--
-- Name: expenses allow_expenses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_expenses ON public.expenses USING (true) WITH CHECK (true);


--
-- Name: exchange_new_items allow_new_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_new_items ON public.exchange_new_items USING (true) WITH CHECK (true);


--
-- Name: purchase_bills allow_purchase_bills; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_purchase_bills ON public.purchase_bills USING (true) WITH CHECK (true);


--
-- Name: purchase_items allow_purchase_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_purchase_items ON public.purchase_items USING (true) WITH CHECK (true);


--
-- Name: exchange_return_items allow_return_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_return_items ON public.exchange_return_items USING (true) WITH CHECK (true);


--
-- Name: suppliers allow_suppliers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_suppliers ON public.suppliers USING (true) WITH CHECK (true);


--
-- Name: wholesale_customers allow_wholesale_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_wholesale_customers ON public.wholesale_customers USING (true) WITH CHECK (true);


--
-- Name: wholesale_sale_items allow_wholesale_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_wholesale_items ON public.wholesale_sale_items USING (true) WITH CHECK (true);


--
-- Name: wholesale_sales allow_wholesale_sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_wholesale_sales ON public.wholesale_sales USING (true) WITH CHECK (true);


--
-- Name: bill_edits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bill_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_edits bill_edits insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bill_edits insert" ON public.bill_edits FOR INSERT WITH CHECK ((store_id = public.auth_store_id()));


--
-- Name: bill_edits bill_edits read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bill_edits read" ON public.bill_edits FOR SELECT USING ((store_id = public.auth_store_id()));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: chart_of_accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: counters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_payments customer_payments insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_payments insert" ON public.customer_payments FOR INSERT WITH CHECK ((store_id = public.auth_store_id()));


--
-- Name: customer_payments customer_payments read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_payments read" ON public.customer_payments FOR SELECT USING ((store_id = public.auth_store_id()));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_bills; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exchange_bills ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_new_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exchange_new_items ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_return_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exchange_return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: gst_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.gst_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: inward_challan_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inward_challan_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inward_challans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inward_challans ENABLE ROW LEVEL SECURITY;

--
-- Name: ledger_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: online_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: physical_stock_counts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.physical_stock_counts ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_offers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.promo_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_bills; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_return_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_returns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_credentials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_damage_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_damage_log ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: website_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: wholesale_customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wholesale_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: wholesale_payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wholesale_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: wholesale_sale_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wholesale_sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wholesale_sales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wholesale_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION admin_password_ok(p_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_password_ok(p_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_password_ok(p_password text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_password_ok(p_password text) TO service_role;


--
-- Name: FUNCTION auth_store_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auth_store_id() TO anon;
GRANT ALL ON FUNCTION public.auth_store_id() TO authenticated;
GRANT ALL ON FUNCTION public.auth_store_id() TO service_role;


--
-- Name: FUNCTION category_for(p_name text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.category_for(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.category_for(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.category_for(p_name text) TO service_role;


--
-- Name: FUNCTION decrement_stock(p_id uuid, qty integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decrement_stock(p_id uuid, qty integer) TO anon;
GRANT ALL ON FUNCTION public.decrement_stock(p_id uuid, qty integer) TO authenticated;
GRANT ALL ON FUNCTION public.decrement_stock(p_id uuid, qty integer) TO service_role;


--
-- Name: FUNCTION delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_exchange(p_exchange_id uuid, p_reason text, p_admin_password text) TO service_role;


--
-- Name: FUNCTION delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_purchase(p_bill_id uuid, p_reason text, p_admin_password text) TO service_role;


--
-- Name: FUNCTION delete_sale(p_sale_id uuid, p_reason text, p_admin_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.delete_sale(p_sale_id uuid, p_reason text, p_admin_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_sale(p_sale_id uuid, p_reason text, p_admin_password text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_sale(p_sale_id uuid, p_reason text, p_admin_password text) TO service_role;


--
-- Name: FUNCTION edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.edit_purchase(p_bill_id uuid, p_changes jsonb, p_items jsonb, p_reason text) TO service_role;


--
-- Name: FUNCTION edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text, p_auth_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text, p_auth_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text, p_auth_password text) TO authenticated;
GRANT ALL ON FUNCTION public.edit_sale(p_sale_id uuid, p_changes jsonb, p_items jsonb, p_reason text, p_auth_login text, p_auth_password text) TO service_role;


--
-- Name: FUNCTION edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.edit_wholesale(p_id uuid, p_changes jsonb, p_items jsonb, p_reason text) TO service_role;


--
-- Name: FUNCTION record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.record_wholesale_payment(p_party uuid, p_amount numeric, p_tender text, p_paid_at timestamp with time zone, p_note text) TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean) TO authenticated;
GRANT ALL ON FUNCTION public.save_purchase(p_bill jsonb, p_items jsonb, p_list_online boolean) TO service_role;


--
-- Name: FUNCTION set_admin_password(p_current text, p_new text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_admin_password(p_current text, p_new text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_admin_password(p_current text, p_new text) TO authenticated;
GRANT ALL ON FUNCTION public.set_admin_password(p_current text, p_new text) TO service_role;


--
-- Name: FUNCTION set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text, p_owner_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text, p_owner_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text, p_owner_password text) TO authenticated;
GRANT ALL ON FUNCTION public.set_staff_password(p_user_id uuid, p_new_password text, p_owner_login text, p_owner_password text) TO service_role;


--
-- Name: FUNCTION set_store_id_from_auth(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_store_id_from_auth() TO anon;
GRANT ALL ON FUNCTION public.set_store_id_from_auth() TO authenticated;
GRANT ALL ON FUNCTION public.set_store_id_from_auth() TO service_role;


--
-- Name: FUNCTION staff_with_password(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.staff_with_password() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_with_password() TO authenticated;
GRANT ALL ON FUNCTION public.staff_with_password() TO service_role;


--
-- Name: FUNCTION verify_staff_password(p_login text, p_password text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.verify_staff_password(p_login text, p_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_staff_password(p_login text, p_password text) TO authenticated;
GRANT ALL ON FUNCTION public.verify_staff_password(p_login text, p_password text) TO service_role;


--
-- Name: FUNCTION wholesale_edit_keeps_due(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.wholesale_edit_keeps_due() TO anon;
GRANT ALL ON FUNCTION public.wholesale_edit_keeps_due() TO authenticated;
GRANT ALL ON FUNCTION public.wholesale_edit_keeps_due() TO service_role;


--
-- Name: TABLE admin_secrets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_secrets TO service_role;


--
-- Name: TABLE bill_edits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bill_edits TO anon;
GRANT ALL ON TABLE public.bill_edits TO authenticated;
GRANT ALL ON TABLE public.bill_edits TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE chart_of_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chart_of_accounts TO anon;
GRANT ALL ON TABLE public.chart_of_accounts TO authenticated;
GRANT ALL ON TABLE public.chart_of_accounts TO service_role;


--
-- Name: TABLE counters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.counters TO anon;
GRANT ALL ON TABLE public.counters TO authenticated;
GRANT ALL ON TABLE public.counters TO service_role;


--
-- Name: TABLE coupons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coupons TO anon;
GRANT ALL ON TABLE public.coupons TO authenticated;
GRANT ALL ON TABLE public.coupons TO service_role;


--
-- Name: TABLE credit_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.credit_notes TO anon;
GRANT ALL ON TABLE public.credit_notes TO authenticated;
GRANT ALL ON TABLE public.credit_notes TO service_role;


--
-- Name: TABLE customer_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_payments TO anon;
GRANT ALL ON TABLE public.customer_payments TO authenticated;
GRANT ALL ON TABLE public.customer_payments TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE exchange_bills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exchange_bills TO anon;
GRANT ALL ON TABLE public.exchange_bills TO authenticated;
GRANT ALL ON TABLE public.exchange_bills TO service_role;


--
-- Name: TABLE exchange_new_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exchange_new_items TO anon;
GRANT ALL ON TABLE public.exchange_new_items TO authenticated;
GRANT ALL ON TABLE public.exchange_new_items TO service_role;


--
-- Name: TABLE exchange_return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exchange_return_items TO anon;
GRANT ALL ON TABLE public.exchange_return_items TO authenticated;
GRANT ALL ON TABLE public.exchange_return_items TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- Name: TABLE gst_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gst_entries TO anon;
GRANT ALL ON TABLE public.gst_entries TO authenticated;
GRANT ALL ON TABLE public.gst_entries TO service_role;


--
-- Name: TABLE inward_challan_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inward_challan_items TO anon;
GRANT ALL ON TABLE public.inward_challan_items TO authenticated;
GRANT ALL ON TABLE public.inward_challan_items TO service_role;


--
-- Name: TABLE inward_challans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inward_challans TO anon;
GRANT ALL ON TABLE public.inward_challans TO authenticated;
GRANT ALL ON TABLE public.inward_challans TO service_role;


--
-- Name: TABLE ledger_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ledger_entries TO anon;
GRANT ALL ON TABLE public.ledger_entries TO authenticated;
GRANT ALL ON TABLE public.ledger_entries TO service_role;


--
-- Name: TABLE loyalty_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.loyalty_transactions TO anon;
GRANT ALL ON TABLE public.loyalty_transactions TO authenticated;
GRANT ALL ON TABLE public.loyalty_transactions TO service_role;


--
-- Name: TABLE online_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.online_orders TO anon;
GRANT ALL ON TABLE public.online_orders TO authenticated;
GRANT ALL ON TABLE public.online_orders TO service_role;


--
-- Name: TABLE physical_stock_counts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.physical_stock_counts TO anon;
GRANT ALL ON TABLE public.physical_stock_counts TO authenticated;
GRANT ALL ON TABLE public.physical_stock_counts TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE promo_offers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.promo_offers TO anon;
GRANT ALL ON TABLE public.promo_offers TO authenticated;
GRANT ALL ON TABLE public.promo_offers TO service_role;


--
-- Name: TABLE purchase_bills; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_bills TO anon;
GRANT ALL ON TABLE public.purchase_bills TO authenticated;
GRANT ALL ON TABLE public.purchase_bills TO service_role;


--
-- Name: TABLE purchase_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_items TO anon;
GRANT ALL ON TABLE public.purchase_items TO authenticated;
GRANT ALL ON TABLE public.purchase_items TO service_role;


--
-- Name: TABLE purchase_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_order_items TO anon;
GRANT ALL ON TABLE public.purchase_order_items TO authenticated;
GRANT ALL ON TABLE public.purchase_order_items TO service_role;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;


--
-- Name: TABLE purchase_return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_return_items TO anon;
GRANT ALL ON TABLE public.purchase_return_items TO authenticated;
GRANT ALL ON TABLE public.purchase_return_items TO service_role;


--
-- Name: TABLE purchase_returns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_returns TO anon;
GRANT ALL ON TABLE public.purchase_returns TO authenticated;
GRANT ALL ON TABLE public.purchase_returns TO service_role;


--
-- Name: TABLE sale_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sale_items TO anon;
GRANT ALL ON TABLE public.sale_items TO authenticated;
GRANT ALL ON TABLE public.sale_items TO service_role;


--
-- Name: TABLE sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales TO anon;
GRANT ALL ON TABLE public.sales TO authenticated;
GRANT ALL ON TABLE public.sales TO service_role;


--
-- Name: TABLE staff_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.staff_credentials TO service_role;


--
-- Name: TABLE stock_damage_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_damage_log TO anon;
GRANT ALL ON TABLE public.stock_damage_log TO authenticated;
GRANT ALL ON TABLE public.stock_damage_log TO service_role;


--
-- Name: TABLE stores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stores TO anon;
GRANT ALL ON TABLE public.stores TO authenticated;
GRANT ALL ON TABLE public.stores TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE website_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.website_settings TO anon;
GRANT ALL ON TABLE public.website_settings TO authenticated;
GRANT ALL ON TABLE public.website_settings TO service_role;


--
-- Name: TABLE wholesale_customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wholesale_customers TO anon;
GRANT ALL ON TABLE public.wholesale_customers TO authenticated;
GRANT ALL ON TABLE public.wholesale_customers TO service_role;


--
-- Name: TABLE wholesale_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wholesale_payments TO anon;
GRANT ALL ON TABLE public.wholesale_payments TO authenticated;
GRANT ALL ON TABLE public.wholesale_payments TO service_role;


--
-- Name: TABLE wholesale_sale_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wholesale_sale_items TO anon;
GRANT ALL ON TABLE public.wholesale_sale_items TO authenticated;
GRANT ALL ON TABLE public.wholesale_sale_items TO service_role;


--
-- Name: TABLE wholesale_sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wholesale_sales TO anon;
GRANT ALL ON TABLE public.wholesale_sales TO authenticated;
GRANT ALL ON TABLE public.wholesale_sales TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--



-- ponytail: local stand-in for Supabase Auth; only what the app calls (password login, get user, change password)
create schema if not exists local_auth;
revoke all on schema local_auth from public;
grant usage on schema local_auth to service_role;
create or replace function local_auth.user_json(u auth.users) returns json language sql stable as $$
  select json_build_object('id',u.id,'aud','authenticated','role','authenticated','email',u.email,
    'email_confirmed_at',u.email_confirmed_at,'app_metadata',coalesce(u.raw_app_meta_data,'{}'),
    'user_metadata',coalesce(u.raw_user_meta_data,'{}'),'created_at',u.created_at,'updated_at',u.updated_at) $$;
create or replace function local_auth.login(email text, password text) returns json
language sql security definer set search_path = auth, extensions as $$
  select local_auth.user_json(u) from auth.users u
  where lower(u.email) = lower(login.email) and u.deleted_at is null
    and u.encrypted_password = crypt(login.password, u.encrypted_password) $$;
create or replace function local_auth.get_user(uid uuid) returns json
language sql security definer set search_path = auth as $$
  select local_auth.user_json(u) from auth.users u where u.id = uid and u.deleted_at is null $$;
create or replace function local_auth.set_password(uid uuid, password text) returns json
language sql security definer set search_path = auth, extensions as $$
  update auth.users set encrypted_password = crypt(password, gen_salt('bf')), updated_at = now() where id = uid;
  select local_auth.get_user(uid) $$;
revoke all on all functions in schema local_auth from public;
grant execute on all functions in schema local_auth to service_role;

-- Every change made on this PC, so the backup sends only what changed.
create schema if not exists local_sync;
create table if not exists local_sync.changes (id bigserial primary key, tbl text not null, pk text not null, at timestamptz not null default now());
create or replace function local_sync.log() returns trigger language plpgsql security definer set search_path = public as $$
declare k text := TG_ARGV[0]; v text;
begin
  v := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end) ->> k;
  insert into local_sync.changes(tbl, pk) values (TG_TABLE_NAME, v);
  if TG_OP = 'UPDATE' and (to_jsonb(OLD) ->> k) is distinct from v then
    insert into local_sync.changes(tbl, pk) values (TG_TABLE_NAME, to_jsonb(OLD) ->> k);
  end if;
  return null;
end $$;
do $$ declare r record; begin
  for r in select c.relname, a.attname from pg_constraint k join pg_class c on c.oid = k.conrelid
           join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
           where k.contype = 'p' and n.nspname = 'public' and array_length(k.conkey, 1) = 1
  loop
    execute format('create trigger zz_local_sync after insert or update or delete on public.%I for each row execute function local_sync.log(%L)', r.relname, r.attname);
  end loop;
end $$;
