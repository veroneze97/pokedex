-- Catálogo de cartas (populado via seed)
CREATE TABLE IF NOT EXISTS cards (
  id             TEXT PRIMARY KEY,          -- ex: "pfl-008" ou UUID
  name           TEXT NOT NULL,
  number         TEXT NOT NULL,             -- "008" (sem /094)
  set_code       TEXT NOT NULL DEFAULT 'PFLpt',
  nationality    TEXT NOT NULL DEFAULT 'PT-BR',
  rarity         TEXT,
  image_url      TEXT,
  tcgdex_card_id TEXT,                      -- ID real na TCGdex (ex: 'me04-004'), usado pra buscar preço
  UNIQUE(number, set_code)
);

-- Migração para bancos existentes:
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_card_id TEXT;

-- Coleção do usuário
CREATE TABLE IF NOT EXISTS collection (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity       INT NOT NULL DEFAULT 1,
  condition      TEXT NOT NULL DEFAULT 'NM',
  purchase_price NUMERIC(10,2),                 -- preço pago por unidade (P&L)
  date_added     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração para bancos existentes:
-- ALTER TABLE collection ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2);

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

-- Histórico do valor total do portfólio (1 snapshot por dia, via upsert)
CREATE TABLE IF NOT EXISTS portfolio_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  total_brl     NUMERIC(12,2) NOT NULL,
  cards_count   INT NOT NULL DEFAULT 0,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- Todo acesso do app passa pela API (service role, que ignora RLS).
-- A anon key fica sem NENHUM acesso: sem policies, RLS bloqueia tudo.
ALTER TABLE cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;

-- ── Catálogo de sets (Fase 1: coleções adicionais) ─────────────────────────
-- Fonte única de verdade sobre quais sets o app suporta. Elimina o hardcode
-- de 'PFLpt'/'ME1pt' espalhado nos endpoints. Abordagem "mínimo-toque":
-- os 2 sets legados reaproveitam os valores atuais de set_code como id,
-- zero migração nos dados já gravados.
CREATE TABLE IF NOT EXISTS sets (
  id            TEXT PRIMARY KEY,       -- 'PFLpt','ME1pt' (legado) | 'me02.5','me03','me04' (novos, = tcgdex_id)
  tcgdex_id     TEXT NOT NULL,           -- ID na API TCGdex (api.tcgdex.net), usado pelo seed script
                                          -- não é único: um mesmo set pode ter 1 linha por idioma
                                          -- (ex: 'me04' → 'me04' PT-BR e 'me04-en' EN), ver migrations/20260716_sets_tcgdex_id_not_unique.sql
  pokemontcg_id TEXT,                   -- ID no pokemontcg.io, usado só para preço USD (nullable)
  id_prefix     TEXT NOT NULL,          -- prefixo do ID da carta, ex: 'pfl' → 'pfl-008'
  name          TEXT NOT NULL,          -- nome oficial PT-BR
  serie         TEXT,                   -- agrupamento (ex: "Megaevolução") — usado na Fase 3
  total         INT NOT NULL,
  release_date  DATE,
  symbol_url    TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bootstrap dos 2 sets legados (os 3 novos são inseridos pelo seed script)
INSERT INTO sets (id, tcgdex_id, pokemontcg_id, id_prefix, name, serie, total, release_date) VALUES
  ('PFLpt', 'me02', 'me2', 'pfl', 'Fogo Fantasmagórico', 'Megaevolução', 130, NULL),
  ('ME1pt', 'me01', 'me1', 'me1', 'Megaevolução',        'Megaevolução', 188, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cards_set_code ON cards(set_code);

-- Garante que toda carta referencia um set cadastrado (os 2 legados já
-- existem em `sets` pelo INSERT acima, então a constraint é satisfeita)
ALTER TABLE cards ADD CONSTRAINT cards_set_code_fkey FOREIGN KEY (set_code) REFERENCES sets(id);

ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- ── Tipo Pokémon por carta (redesign visual premium) ───────────────────────
-- Usado só para o glow de borda por tipo nos CardTiles da Coleção/Dashboard.
-- Nullable: cartas sem tipo (ainda não populado, ou tipo fora do mapa) caem
-- no glow dourado padrão — nunca quebra o layout.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS type TEXT;
