-- =================================================================================
-- HSN code per category: every product in the category prints / files with it.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- A code typed on a single product still wins; this only fills the gaps.
-- Seeded with the three the shop's Logic invoice (GT/40) uses; set the rest in
-- Settings -> Shop Info -> HSN code by category. Spellings that differ only by
-- capitals, spaces or dashes (TOP / top, 3 pc / 3pc) are the same category.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS hsn_code TEXT;

UPDATE categories SET hsn_code = '6106'
 WHERE coalesce(hsn_code, '') = '' AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') IN ('top', 'tshirt');
UPDATE categories SET hsn_code = '6206'
 WHERE coalesce(hsn_code, '') = '' AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = 'shortmidi';
