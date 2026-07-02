-- Catálogo de cartas (populado via seed)
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,          -- ex: "pfl-008" ou UUID
  name        TEXT NOT NULL,
  number      TEXT NOT NULL,             -- "008" (sem /094)
  set_code    TEXT NOT NULL DEFAULT 'PFLpt',
  nationality TEXT NOT NULL DEFAULT 'PT-BR',
  rarity      TEXT,
  image_url   TEXT,
  UNIQUE(number, set_code)
);

-- Coleção do usuário
CREATE TABLE IF NOT EXISTS collection (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity   INT NOT NULL DEFAULT 1,
  condition  TEXT NOT NULL DEFAULT 'NM',
  date_added TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de preços (nunca deletar)
CREATE TABLE IF NOT EXISTS price_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  price_brl     NUMERIC(10,2) NOT NULL,
  source        TEXT NOT NULL,            -- 'ligapokemon' | 'mercadolivre'
  date_recorded TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_price_history_card_date ON price_history(card_id, date_recorded DESC);
CREATE INDEX IF NOT EXISTS idx_collection_card_id ON collection(card_id);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Todo acesso do app passa pela API (service role, que ignora RLS).
-- A anon key fica sem NENHUM acesso: sem policies, RLS bloqueia tudo.
ALTER TABLE cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
