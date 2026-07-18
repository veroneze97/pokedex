-- ID real da carta na TCGdex (ex: 'me04-004' ou 'swsh3-4') — usado pra buscar
-- preço via api.tcgdex.net. Nullable: cartas sem correspondência (raro) caem
-- no fallback de preço manual já existente, sem quebrar nada.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_card_id TEXT;
