-- ═══════════════════════════════════════════════════════════
-- GSOFT ERP — POS MODULE DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── COUNTERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50)  NOT NULL,
  location   VARCHAR(100),
  is_active  BOOLEAN DEFAULT TRUE
);

INSERT INTO counters (name, location) VALUES
  ('Counter 1', 'Ground Floor'),
  ('Counter 2', 'First Floor')
ON CONFLICT DO NOTHING;

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  role        VARCHAR(30)  NOT NULL DEFAULT 'cashier',
  counter_id  UUID REFERENCES counters(id),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUPPLIERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  gstin      VARCHAR(20),
  phone      VARCHAR(20),
  email      VARCHAR(150),
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CATEGORIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id)
);

-- ── PRODUCTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(150) NOT NULL,
  sku              VARCHAR(80)  UNIQUE NOT NULL,
  barcode          VARCHAR(100) UNIQUE,
  serial_barcode   VARCHAR(100) UNIQUE,
  category_id      UUID REFERENCES categories(id),
  supplier_id      UUID REFERENCES suppliers(id),
  unit_price       NUMERIC(10,2) NOT NULL,
  cost_price       NUMERIC(10,2),
  gst_rate         NUMERIC(5,2) DEFAULT 18,
  photo_url        TEXT,
  stock_qty        INTEGER DEFAULT 0,
  low_stock_alert  INTEGER DEFAULT 5,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── CUSTOMERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(20)  UNIQUE NOT NULL,
  email          VARCHAR(150) UNIQUE,
  gstin          VARCHAR(20),
  loyalty_points INTEGER DEFAULT 0,
  total_spent    NUMERIC(14,2) DEFAULT 0,
  referral_code  VARCHAR(20) UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  referred_by    UUID REFERENCES customers(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── COUPONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50) UNIQUE NOT NULL,
  type             VARCHAR(20) NOT NULL CHECK (type IN ('flat','percentage','gift')),
  value            NUMERIC(10,2) NOT NULL,
  min_order_value  NUMERIC(10,2) DEFAULT 0,
  max_discount_cap NUMERIC(10,2),
  max_uses         INTEGER,
  used_count       INTEGER DEFAULT 0,
  valid_from       DATE NOT NULL,
  valid_to         DATE NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE
);

-- Sample coupons
INSERT INTO coupons (code, type, value, min_order_value, valid_from, valid_to) VALUES
  ('SAVE100', 'flat', 100, 500, CURRENT_DATE, CURRENT_DATE + 30),
  ('OFF10', 'percentage', 10, 200, CURRENT_DATE, CURRENT_DATE + 30)
ON CONFLICT DO NOTHING;

-- ── PROMO OFFERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          VARCHAR(100) NOT NULL,
  discount_type  VARCHAR(20) NOT NULL CHECK (discount_type IN ('flat','percentage','bogo','free_gift')),
  discount_value NUMERIC(10,2) NOT NULL,
  applies_to     VARCHAR(20) NOT NULL CHECK (applies_to IN ('all','category','product')),
  target_id      UUID,
  valid_from     TIMESTAMPTZ NOT NULL,
  valid_to       TIMESTAMPTZ NOT NULL,
  is_active      BOOLEAN DEFAULT TRUE
);

-- ── SALES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no           VARCHAR(50) UNIQUE NOT NULL,
  customer_id          UUID REFERENCES customers(id),
  salesman_id          UUID REFERENCES users(id),
  counter_id           UUID NOT NULL REFERENCES counters(id),
  total_amount         NUMERIC(12,2) NOT NULL,
  discount_amount      NUMERIC(12,2) DEFAULT 0,
  coupon_code          VARCHAR(50),
  net_amount           NUMERIC(12,2) NOT NULL,
  gst_amount           NUMERIC(10,2) DEFAULT 0,
  payment_mode         VARCHAR(20) NOT NULL DEFAULT 'cash'
                         CHECK (payment_mode IN ('cash','card','upi','credit')),
  loyalty_points_used  INTEGER DEFAULT 0,
  is_return            BOOLEAN DEFAULT FALSE,
  return_ref_id        UUID REFERENCES sales(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALE ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  barcode      VARCHAR(100) NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(10,2) NOT NULL,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  gst_rate     NUMERIC(5,2) DEFAULT 18,
  line_total   NUMERIC(12,2) NOT NULL
);

-- ── LOYALTY TRANSACTIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  sale_id       UUID REFERENCES sales(id),
  type          VARCHAR(20) NOT NULL CHECK (type IN ('earn','redeem','bonus','referral')),
  points_delta  INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── STOCK DAMAGE LOG ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_damage_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  type       VARCHAR(20) DEFAULT 'damage' CHECK (type IN ('damage','loss','theft','expiry')),
  reason     TEXT,
  logged_by  UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- STORED PROCEDURE: Decrement stock safely
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_qty = GREATEST(0, stock_qty - qty)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════
-- Enable RLS on sensitive tables
ALTER TABLE sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;

-- For now, allow authenticated users to access all rows
-- Tighten per-role in production
CREATE POLICY "Authenticated users can manage sales"
  ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage sale_items"
  ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage customers"
  ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read for products, categories (needed for POS product search)
ALTER TABLE products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active products"
  ON products FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated can manage products"
  ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can read categories"
  ON categories FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA — Sample products for testing
-- ═══════════════════════════════════════════════════════════
INSERT INTO categories (name) VALUES
  ('Electronics'), ('Clothing'), ('Food & Beverage'), ('Home & Kitchen')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku, barcode, unit_price, cost_price, gst_rate, stock_qty, low_stock_alert)
VALUES
  ('Samsung Galaxy Buds', 'SKU-001', '8901234567890', 2999.00, 2200.00, 18, 50, 5),
  ('Cotton T-Shirt (Blue, L)', 'SKU-002', '8901234567891', 499.00, 250.00, 5, 120, 10),
  ('Basmati Rice 1kg', 'SKU-003', '8901234567892', 89.00, 55.00, 0, 200, 20),
  ('Steel Water Bottle 1L', 'SKU-004', '8901234567893', 349.00, 180.00, 18, 75, 8),
  ('Wireless Mouse', 'SKU-005', '8901234567894', 799.00, 500.00, 18, 30, 5),
  ('A4 Notebook (200 pages)', 'SKU-006', '8901234567895', 120.00, 70.00, 12, 500, 50)
ON CONFLICT DO NOTHING;
