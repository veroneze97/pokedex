-- Preço agora vem da TCGdex (api/_tcgdexPricing.js + cards.tcgdex_card_id),
-- não mais da Pokémon TCG API — pokemontcg_id não é lido em lugar nenhum
-- do código a partir desta mudança.

ALTER TABLE sets DROP COLUMN IF EXISTS pokemontcg_id;
