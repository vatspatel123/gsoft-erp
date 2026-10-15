-- =================================================================================
-- Commission per staff member, set by the shop (store policy).
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- A percentage of what that person sold. 0 means no commission, which is how every
-- existing staff member starts, so nothing changes until the shop sets a rate.
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_pct NUMERIC NOT NULL DEFAULT 0;
DO $c$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_commission_pct_check CHECK (commission_pct >= 0 AND commission_pct <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $c$;
