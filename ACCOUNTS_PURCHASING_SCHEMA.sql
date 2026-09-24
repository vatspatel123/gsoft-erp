-- =================================================================================
-- Accounts & Purchasing Migration  (Phase 2)
-- Run in: Supabase Dashboard → SQL Editor → project cogrniduhhoeepdkesjx
-- =================================================================================
--
-- WHY THIS EXISTS
--  1. purchase_orders and inward_challans exist in the DB but are skeletal
--     (only id, *_no, supplier_id, status, total_amount, created_at) and have no
--     line-item child tables, no dates, and no links to each other or to bills.
--     Both are currently EMPTY (verified: rows=0), so these changes need no backfill.
--  2. purchase_order_items and inward_challan_items do not exist at all.
--  3. BUG FIX: usePOS.ts (~line 505) writes credit_due_days / credit_due_date /
--     credit_status on every Credit ("udhar") sale, but none of those columns exist
--     on `sales`. PostgREST rejects the insert, the catch block silently saves the
--     bill to localStorage instead, and the cashier sees "Bill saved!" — this is the
--     "N Local Bill (Sync)" badge in POS. Section 5 fixes it.
--  4. BUG FIX: useNotifications.ts (~line 71) selects `bill_amount` from
--     inward_challans, which does not exist, so the supplier-dues reminder silently
--     never fires. Section 4 adds it.
--
-- NOTE ON RLS: sections 6 uses the same tenant-isolation pattern as
-- NEW_FEATURES_SCHEMA.sql (store_id = auth_store_id(), plus a BEFORE INSERT trigger
-- that stamps store_id from the session). That pattern is already proven working in
-- this project. If rows ever appear to "vanish" from these screens, the first thing
-- to check is that auth_store_id() resolves for the logged-in session.
-- =================================================================================


-- 1. Purchase order line items -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    design_no TEXT,
    size TEXT,
    colour TEXT,
    qty_ordered INTEGER NOT NULL DEFAULT 0,
    qty_received INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 2. Inward challan line items -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inward_challan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    inward_challan_id UUID REFERENCES public.inward_challans(id) ON DELETE CASCADE,
    purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    design_no TEXT,
    size TEXT,
    colour TEXT,
    batch_no TEXT,
    qty_received INTEGER NOT NULL DEFAULT 0,
    qty_damaged INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 3. Flesh out purchase_orders -----------------------------------------------------
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_date DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;


-- 4. Flesh out inward_challans -----------------------------------------------------
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS challan_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS purchase_bill_id UUID REFERENCES public.purchase_bills(id) ON DELETE SET NULL;
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS received_by TEXT;
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS notes TEXT;
-- Referenced by useNotifications.ts but missing until now:
ALTER TABLE public.inward_challans ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(10,2) DEFAULT 0;


-- 5. BUG FIX: credit ("udhar") sales ------------------------------------------------
-- Without these, every Credit-mode sale fails its insert and falls back to the
-- offline queue. Names/types match exactly what usePOS.ts writes.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_due_days INTEGER;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_due_date DATE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'unpaid'
    CHECK (credit_status IN ('unpaid', 'partial', 'paid'));


-- 6. RLS + auto store_id stamping ---------------------------------------------------
ALTER TABLE public.purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_challan_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_challans       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['purchase_orders', 'purchase_order_items', 'inward_challans', 'inward_challan_items'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Isolation Policy" ON public.%I FOR ALL USING (store_id = auth_store_id())', t);

        EXECUTE format('DROP TRIGGER IF EXISTS set_store_id_trigger ON public.%I', t);
        EXECUTE format('CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION set_store_id_from_auth()', t);
    END LOOP;
END $$;


-- 7. Indexes ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_po_items_order        ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON public.inward_challan_items(inward_challan_id);
CREATE INDEX IF NOT EXISTS idx_challan_po            ON public.inward_challans(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier           ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status             ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_credit_status   ON public.sales(credit_status) WHERE credit_status <> 'paid';


-- 8. Verification (optional — run after the above) -----------------------------------
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'purchase_orders' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'sales' AND column_name LIKE 'credit%';
