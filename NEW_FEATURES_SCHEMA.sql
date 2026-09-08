-- =================================================================================
-- Credit Notes & Purchase Returns Migration Script
-- Run this in your Supabase Dashboard SQL Editor
-- =================================================================================

-- 1. Create Credit Notes table
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    credit_note_no TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    original_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
    notes TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Purchase Returns table
CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    return_no TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    supplier_phone TEXT,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Purchase Return Items table
CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    purchase_return_id UUID REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    sku TEXT,
    barcode TEXT,
    size TEXT,
    colour TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['credit_notes', 'purchase_returns', 'purchase_return_items'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Isolation Policy" ON public.%I FOR ALL USING (store_id = auth_store_id())', t);
    END LOOP;
END $$;

-- 6. Apply Auto Store ID Trigger
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['credit_notes', 'purchase_returns', 'purchase_return_items'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_store_id_trigger ON public.%I', t);
        EXECUTE format('CREATE TRIGGER set_store_id_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION set_store_id_from_auth()', t);
    END LOOP;
END $$;
