# Fase 1 — Tabela `sets` e catálogo config-driven

**Data:** 2026-07-08
**Status:** Aprovado, pronto para implementação

## Contexto

O PokeDex PT-BR hoje suporta 2 sets (Fogo Fantasmagórico `PFLpt`, 130 cartas; Mega Evolução `ME1pt`, 188 cartas), mas os códigos desses sets estão **hardcoded em 6 arquivos**: `api/cards.js`, `api/identify.js`, `api/price.js`, `api/collection.js`, `src/pages/Pokedex.jsx`, `src/pages/Dashboard.jsx`. Adicionar um set novo hoje exige editar os 6 arquivos manualmente.

Pesquisa confirmou que a **TCGdex API** (`api.tcgdex.net`, gratuita, sem chave) tem 120 sets com nomes/raridade oficiais em português, incluindo o restante da era Mega Evolução:

| tcgdex_id | Nome PT-BR | Total |
|---|---|---|
| `me02.5` | Heróis Excelsos | 295 |
| `me03` | Equilíbrio Perfeito | 124 |
| `me04` | Caos Ascendente | 122 |

## Objetivo

1. Criar uma tabela `sets` no Supabase que vira a fonte única de verdade sobre quais sets o app suporta.
2. Tornar os 6 pontos hardcoded config-driven, lendo de `sets`.
3. Seedar os 3 sets novos (541 cartas) via script idempotente, usando a TCGdex API.
4. Resultado: adicionar um set futuro passa a ser 1 INSERT + rodar o seed script — zero edição de código.

## Decisões

- **Compatibilidade de IDs (Abordagem A, mínimo-toque):** `sets.id` reaproveita os valores atuais (`PFLpt`, `ME1pt`) para os 2 sets existentes — **zero migração** nos dados já gravados (cards, collection, price_history). Sets novos usam o próprio ID do TCGdex como `sets.id` (`me02.5`, `me03`, `me04`).
- **Imagens:** só os 3 sets novos recebem imagens PT-BR do TCGdex. Os 2 sets existentes mantêm as imagens atuais (pokemontcg.io, scans em inglês) — sem risco de regressão visual em cartas já na coleção do usuário.
- **Escopo:** Fase 1 completa — schema + de-hardcoding + seed dos 3 sets novos, tudo na mesma leva (não dividir em Fase 1 enxuta / Fase 2 seed).

## Schema

```sql
CREATE TABLE sets (
  id            TEXT PRIMARY KEY,       -- 'PFLpt','ME1pt' (legado) | 'me02.5','me03','me04' (novos, = tcgdex_id)
  tcgdex_id     TEXT NOT NULL UNIQUE,   -- ID na API TCGdex, usado só pelo seed script
  pokemontcg_id TEXT,                   -- ID no pokemontcg.io, usado só para preço USD (nullable)
  id_prefix     TEXT NOT NULL,          -- 'pfl','me1','me025','me03','me04' — prefixo do ID da carta
  name          TEXT NOT NULL,          -- nome oficial PT-BR
  serie         TEXT,                   -- agrupamento (ex: "Mega Evolução") — usado na Fase 3 (tela de coleções)
  total         INT NOT NULL,
  release_date  DATE,
  symbol_url    TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_set_code ON cards(set_code);
ALTER TABLE cards ADD CONSTRAINT cards_set_code_fkey FOREIGN KEY (set_code) REFERENCES sets(id);
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
```

Ordem de aplicação: criar `sets` → inserir as 5 linhas (2 legadas + 3 novas) → só então adicionar a FK em `cards.set_code` (os valores legados já precisam existir em `sets.id` antes da constraint ser válida).

Linhas iniciais de `sets` (metadados já levantados do TCGdex):

| id | tcgdex_id | pokemontcg_id | id_prefix | name | total |
|---|---|---|---|---|---|
| `PFLpt` | `me02` | `me2` | `pfl` | Fogo Fantasmagórico | 130 |
| `ME1pt` | `me01` | `me1` | `me1` | Megaevolução | 188 |
| `me02.5` | `me02.5` | `null` | `me025` | Heróis Excelsos | 295 |
| `me03` | `me03` | `null` | `me03` | Equilíbrio Perfeito | 124 |
| `me04` | `me04` | `null` | `me04` | Caos Ascendente | 122 |

## De-hardcoding — os 6 pontos

| Arquivo | Antes | Depois |
|---|---|---|
| `api/cards.js` | `.in('set_code', ['PFLpt','ME1pt'])` | `SELECT id FROM sets WHERE ativo` → usa a lista dinâmica |
| `api/identify.js` | prompt do Claude Vision com regra fixa "total 130→PFLpt, 132/188→ME1pt" | prompt monta as regras dinamicamente a partir de `sets` (id + total) |
| `api/price.js` | `setMap` local com 2 entradas hardcoded | lê `pokemontcg_id` da linha correspondente em `sets` |
| `api/collection.js` | `idPrefix = setCode==='ME1pt' ? 'me1' : 'pfl'` | lê `id_prefix` da linha correspondente em `sets` |
| `src/pages/Pokedex.jsx` | array `SETS` local hardcoded (chips do seletor) | `/api/cards` passa a devolver `sets` no payload; Pokedex consome dali |
| `src/pages/Dashboard.jsx` | `FALLBACK_TOTAL = 318` | soma `sets.total` quando os dados carregam; a constante vira só fallback do 1º load/offline |

## Seed script

`scripts/seed-set.js <tcgdex_id>` (Node, roda manualmente):
1. Busca `https://api.tcgdex.net/v2/pt/sets/{tcgdex_id}`
2. Para cada carta: `id = {id_prefix}-{numero com 3 dígitos}`, nome/raridade/número direto do payload (já em PT-BR), `image_url = {card.image}/high.webp`
3. `upsert` em `sets` (1 linha) e `cards` (N linhas) via service role — idempotente, pode rodar de novo sem duplicar

## Rollout

1. Aplicar migration SQL (tabela + índice + FK + insert das 5 linhas)
2. Rodar `node scripts/seed-set.js me02.5`, depois `me03`, depois `me04` (541 cartas novas)
3. Atualizar os 6 arquivos para ler de `sets`
4. Deploy

## Verificação

- Build + lint limpos
- Preview: seletor de set no Pokédex mostra 5 sets com contagens corretas
- `/api/cards` retorna ~938 cartas totais e o array `sets`
- Confirmar que as 318 cartas/coleção/histórico de preço existentes permanecem intactos (nenhum UPDATE neles nesta fase)
- Lógica do prompt do scanner validada por inspeção (não há como testar a câmera real em preview): total 295→`me02.5`, 124→`me03`, 122→`me04`

## Fora de escopo (fica para depois)

- Migrar imagens dos 2 sets existentes para PT-BR
- Tela de lista de coleções (Fase 3 — só faz sentido com mais sets acumulados)
- Preço via `pokemontcg_id` para os 3 sets novos (ficam `null` — sem TCGPlayer, sem $; útil pesquisar depois se a Pokémon TCG API já cobre esses sets)
