-- =================================================================================
-- Merge category names that are the same thing spelled differently (TOP / top,
-- 3 pc / 3pc), and stop new ones appearing.
-- Run in: Supabase Dashboard -> SQL Editor -> project cogrniduhhoeepdkesjx
-- =================================================================================
-- Same thing = same name ignoring capitals, spaces and dashes. The spelling with the
-- most products is kept; the others' products move to it and the empty names go.
-- Nothing is deleted except an emptied duplicate name: no product, bill or stock changes.

-- 1. Keep one spelling per name, move everything else onto it.
WITH keep AS (
  SELECT DISTINCT ON (regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'))
         regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') AS key, c.id, c.name
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
   GROUP BY key, c.id, c.name
   ORDER BY key, count(p.id) DESC, c.name
), dup AS (
  SELECT c.id, k.id AS keep_id, c.hsn_code
    FROM categories c
    JOIN keep k ON k.key = regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')
   WHERE c.id <> k.id
)
UPDATE products p SET category_id = d.keep_id FROM dup d WHERE p.category_id = d.id;

-- 2. An HSN set only on a duplicate is kept on the name that stays.
WITH keep AS (
  SELECT DISTINCT ON (regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'))
         regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') AS key, c.id
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
   GROUP BY key, c.id, c.name
   ORDER BY key, count(p.id) DESC, c.name
)
UPDATE categories t SET hsn_code = src.hsn_code
  FROM (SELECT k.id AS keep_id, max(c.hsn_code) AS hsn_code
          FROM categories c JOIN keep k ON k.key = regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')
         WHERE c.id <> k.id AND nullif(trim(c.hsn_code), '') IS NOT NULL
         GROUP BY k.id) src
 WHERE t.id = src.keep_id AND nullif(trim(t.hsn_code), '') IS NULL;

-- 3. A duplicate used as a parent points at the name that stays, then the empties go.
WITH keep AS (
  SELECT DISTINCT ON (regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g'))
         regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') AS key, c.id
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
   GROUP BY key, c.id, c.name
   ORDER BY key, count(p.id) DESC, c.name
), dup AS (
  SELECT c.id, k.id AS keep_id FROM categories c
    JOIN keep k ON k.key = regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')
   WHERE c.id <> k.id
)
UPDATE categories c SET parent_id = d.keep_id FROM dup d WHERE c.parent_id = d.id;

DELETE FROM categories c
 USING (SELECT DISTINCT ON (regexp_replace(lower(x.name), '[^a-z0-9]', '', 'g'))
               regexp_replace(lower(x.name), '[^a-z0-9]', '', 'g') AS key, x.id
          FROM categories x LEFT JOIN products p ON p.category_id = x.id
         GROUP BY key, x.id, x.name ORDER BY key, count(p.id) DESC, x.name) k
 WHERE k.key = regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g')
   AND c.id <> k.id
   AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id);

-- 4. Stop it happening again: Purchase Entry now matches a category ignoring
--    capitals, spaces and dashes, so "3pc" finds the existing "3 pc".
CREATE OR REPLACE FUNCTION public.category_for(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.category_for(TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.category_for(TEXT) TO authenticated;
