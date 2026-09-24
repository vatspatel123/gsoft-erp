-- Missing E-commerce Schema for gsoft-erp
-- Run these commands in the Supabase SQL Editor (Project: cogrniduhhoeepdkesjx)
--
-- Discovered 2026-09-14: the "e-commerce integration" code (websiteBridge.ts,
-- useOnlineStore.ts, useWebsiteSettings.ts, OnlineOrdersPage/OnlineListingsPage/
-- WebsiteSettingsPage) references these columns/tables, but none of them exist
-- on this Supabase project — no prior SQL file in this repo defines them either.
-- This creates exactly what the existing TypeScript types (src/types/ecommerce.ts)
-- and hooks expect, nothing more.

-- 1. E-commerce columns on products (used by useOnlineStore.ts / websiteBridge.ts)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_discount_pct NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS online_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
-- No RLS change needed here: anon SELECT on products already works today.

-- 2. website_settings table (single row, edited from WebsiteSettingsPage,
--    read by the public storefront) — matches WebsiteSettings type exactly.
CREATE TABLE IF NOT EXISTS website_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'GSoft Retail Store',
  tagline TEXT DEFAULT '',
  logo_url TEXT,
  hero_title TEXT DEFAULT '',
  hero_subtitle TEXT DEFAULT '',
  hero_banner_url TEXT,
  hero_banners TEXT[] DEFAULT '{}',
  announcement_bar TEXT DEFAULT '',
  show_announcement BOOLEAN DEFAULT true,
  whatsapp_number TEXT DEFAULT '',
  enable_whatsapp_checkout BOOLEAN DEFAULT true,
  enable_cod BOOLEAN DEFAULT true,
  min_order_free_shipping NUMERIC DEFAULT 999,
  standard_delivery_fee NUMERIC DEFAULT 70,
  theme_color TEXT DEFAULT '#9333ea',
  instagram_url TEXT,
  facebook_url TEXT,
  contact_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_website_settings" ON website_settings;
CREATE POLICY "allow_all_website_settings"
  ON website_settings FOR ALL
  USING (true) WITH CHECK (true);

-- 3. online_orders table (written by the public storefront via
--    placeStorefrontOrder, read/managed from OnlineOrdersPage) — matches
--    OnlineOrder / OnlineOrderItem types exactly.
CREATE TABLE IF NOT EXISTS online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','online','upi','whatsapp')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  order_status TEXT NOT NULL DEFAULT 'new' CHECK (order_status IN ('new','confirmed','packed','shipped','delivered','cancelled')),
  tracking_number TEXT,
  tracking_courier TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_online_orders" ON online_orders;
CREATE POLICY "allow_all_online_orders"
  ON online_orders FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_online_orders_order_no ON online_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_is_online ON products(is_online) WHERE is_online = true;
