-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Consolida linhas duplicadas e torna o incremento de quantidade atômico.

WITH ranked AS (
  SELECT
    id,
    card_id,
    row_number() OVER (PARTITION BY card_id ORDER BY date_added, id) AS rn,
    sum(quantity) OVER (PARTITION BY card_id) AS total_quantity
  FROM collection
)
UPDATE collection c
SET quantity = ranked.total_quantity
FROM ranked
WHERE c.id = ranked.id AND ranked.rn = 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY card_id ORDER BY date_added, id) AS rn
  FROM collection
)
DELETE FROM collection c
USING ranked
WHERE c.id = ranked.id AND ranked.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'collection_card_id_key'
  ) THEN
    ALTER TABLE collection ADD CONSTRAINT collection_card_id_key UNIQUE (card_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION add_to_collection(p_card_id TEXT, p_purchase_price NUMERIC DEFAULT NULL)
RETURNS SETOF collection
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO collection (card_id, quantity, condition, purchase_price, date_added)
  VALUES (p_card_id, 1, 'NM', p_purchase_price, NOW())
  ON CONFLICT (card_id) DO UPDATE
  SET quantity = collection.quantity + 1,
      purchase_price = COALESCE(EXCLUDED.purchase_price, collection.purchase_price)
  RETURNING collection.*;
END;
$$;
