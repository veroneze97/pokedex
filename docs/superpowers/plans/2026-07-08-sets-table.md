# Fase 1 — Tabela `sets` e catálogo config-driven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o catálogo de sets do PokeDex config-driven (tabela `sets`), eliminando os 6 hardcodes de `PFLpt`/`ME1pt` espalhados no código, e popular 3 sets novos da era Mega Evolução via TCGdex API.

**Architecture:** Nova tabela `sets` no Supabase vira fonte única de verdade sobre quais sets o app suporta. Um helper compartilhado `api/_sets.js` é consumido pelos 4 endpoints serverless que hoje hardcodam `PFLpt`/`ME1pt`. Um script `scripts/seed-set.js` busca dados reais (nome/raridade/imagem PT-BR) da TCGdex API e faz upsert idempotente em `sets`+`cards`. O frontend (`Pokedex.jsx`) passa a consumir a lista de sets vinda da API em vez de um array local.

**Tech Stack:** Node 20 (scripts), Vercel Serverless Functions, Supabase (Postgres + supabase-js v2), React 19 + Vite, TCGdex API (`api.tcgdex.net/v2/pt`) como fonte de dados PT-BR.

## Global Constraints

- A migration SQL deste plano deve ser aplicada **manualmente pelo usuário** no SQL Editor do Supabase — o conector MCP disponível neste ambiente não enxerga o projeto Supabase do PokeDex (só projetos não relacionados: `drmeds`, `english-content-coach`).
- O script de seed precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` reais no `.env` local. Hoje o `.env` está desatualizado — só tem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (resquício de antes da refatoração de segurança que removeu o acesso direto do client ao Supabase). **O usuário deve atualizar o `.env` local** com os valores reais (do painel Vercel → Settings → Environment Variables) antes da Task 3. Não peça para colar os valores no chat — é um segredo.
- Este projeto não tem test runner configurado (sem Jest/Vitest). A verificação de cada task usa build, lint, checagem de sintaxe, chamadas HTTP reais contra o deploy, e as ferramentas `preview_*` — não testes unitários automatizados. Este é o padrão já estabelecido no restante do código (nenhum arquivo `*.test.js` existe no repo).
- Endpoints em `api/*.js` só executam de fato no Vercel — `npm run dev` local só sobe o frontend Vite, não as serverless functions. Verificação de mudanças em `api/*.js` acontece via `git push` (deploy automático) + `curl` contra produção, checando build/runtime logs com as ferramentas MCP da Vercel se algo falhar.
- Node local: v20.19.5 — usar `node --env-file=.env` para o script de seed (evita adicionar a dependência `dotenv`, YAGNI).
- Nenhuma das 318 cartas/coleção/histórico de preço já existentes deve ser alterada nesta fase (abordagem de IDs "mínimo-toque" do spec aprovado).

## File Structure

**Create:**
- `api/_sets.js` — helper compartilhado: `getActiveSets(supabase)`, `getSetByCode(supabase, code)`
- `scripts/seed-set.js` — CLI: busca um set completo da TCGdex API e faz upsert em `sets` + `cards`

**Modify:**
- `supabase-schema.sql` — adiciona tabela `sets`, índice, FK, seed dos 2 sets legados
- `api/cards.js` — usa `getActiveSets`, inclui `sets` na resposta JSON
- `api/collection.js` — usa `getSetByCode` para resolver `id_prefix` (fluxo de câmera)
- `api/price.js` — usa `getSetByCode` para resolver `pokemontcg_id`
- `api/identify.js` — usa `getActiveSets` para montar a regra de `setCode` do prompt dinamicamente
- `src/pages/Pokedex.jsx` — consome `sets` da API em vez do array local `SETS`
- `src/pages/Dashboard.jsx` — atualiza comentário/valor do fallback `FALLBACK_TOTAL`

---

### Task 1: Migration SQL — tabela `sets`

**Files:**
- Modify: `supabase-schema.sql` (append ao final do arquivo)

**Interfaces:**
- Produces: tabela `sets` com colunas `id, tcgdex_id, pokemontcg_id, id_prefix, name, serie, total, release_date, symbol_url, ativo, created_at` — consumida por `api/_sets.js` (Task 2) e pelo script de seed (Task 3)

- [ ] **Step 1: Adicionar o bloco SQL ao final de `supabase-schema.sql`**

```sql

-- ── Catálogo de sets (Fase 1: coleções adicionais) ─────────────────────────
-- Fonte única de verdade sobre quais sets o app suporta. Elimina o hardcode
-- de 'PFLpt'/'ME1pt' espalhado nos endpoints. Abordagem "mínimo-toque":
-- os 2 sets legados reaproveitam os valores atuais de set_code como id,
-- zero migração nos dados já gravados.
CREATE TABLE IF NOT EXISTS sets (
  id            TEXT PRIMARY KEY,       -- 'PFLpt','ME1pt' (legado) | 'me02.5','me03','me04' (novos, = tcgdex_id)
  tcgdex_id     TEXT NOT NULL UNIQUE,   -- ID na API TCGdex (api.tcgdex.net), usado pelo seed script
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
```

- [ ] **Step 2: Commitar o arquivo atualizado**

```bash
git add supabase-schema.sql
git commit -m "$(cat <<'EOF'
feat: adiciona tabela sets ao schema (Fase 1 - colecoes adicionais)

Tabela sets vira fonte unica de verdade sobre os sets suportados.
Abordagem minimo-toque: sets legados (PFLpt/ME1pt) reaproveitam os
valores atuais de set_code como id, zero migracao nos dados existentes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Aplicar a migration manualmente no Supabase**

Este step é do **usuário**, não do agente (sem acesso MCP a este projeto Supabase):
1. Abrir o painel do Supabase → SQL Editor
2. Colar e rodar o bloco SQL do Step 1
3. Confirmar sucesso (sem erros de sintaxe/constraint)

- [ ] **Step 4: Verificar a migration**

Pedir ao usuário para rodar esta query no SQL Editor e colar o resultado, ou aguardar confirmação verbal:

```sql
SELECT id, name, total, id_prefix FROM sets ORDER BY id;
```

Esperado: 2 linhas (`ME1pt` / Megaevolução / 188 / me1, `PFLpt` / Fogo Fantasmagórico / 130 / pfl).

---

### Task 2: `api/_sets.js` — helper compartilhado

**Files:**
- Create: `api/_sets.js`

**Interfaces:**
- Consumes: client `supabase` (instância já criada por cada arquivo chamador, mesmo padrão de `api/_portfolio.js`)
- Produces: `getActiveSets(supabase): Promise<Array<{id, tcgdex_id, pokemontcg_id, id_prefix, name, serie, total, release_date, symbol_url, ativo}>>`, `getSetByCode(supabase, code): Promise<Object|null>` — consumidos pelas Tasks 4-7

- [ ] **Step 1: Criar `api/_sets.js`**

```js
// Fonte única de verdade sobre quais sets o catálogo suporta.
// Evita hardcode de códigos de set espalhado pelos outros endpoints.

export async function getActiveSets(supabase) {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('ativo', true)
    .order('release_date', { ascending: true, nullsFirst: true })
  if (error) throw error
  return data || []
}

export async function getSetByCode(supabase, code) {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('id', code)
    .maybeSingle()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check api/_sets.js`
Expected: sem output (sintaxe válida)

- [ ] **Step 3: Commit**

```bash
git add api/_sets.js
git commit -m "$(cat <<'EOF'
feat: helper compartilhado para leitura da tabela sets

getActiveSets/getSetByCode centralizam o acesso a sets, consumidos
pelos 4 endpoints que hoje hardcodam PFLpt/ME1pt.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `scripts/seed-set.js` — seed via TCGdex API

**Files:**
- Create: `scripts/seed-set.js`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_KEY` (via `--env-file`), argumento CLI `tcgdex_id`
- Produces: linhas em `sets` e `cards` no Supabase — consumido pelas Tasks 4-9 (que dependem dos dados existirem para verificação end-to-end)

**Pré-requisito (usuário, antes deste task):** atualizar `.env` local com `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` reais (painel Vercel → Settings → Environment Variables). Confirmar aqui antes de prosseguir.

- [ ] **Step 1: Criar `scripts/seed-set.js`**

```js
/**
 * Busca um set completo da TCGdex API (nomes/raridade/imagem em PT-BR) e
 * faz upsert em `sets` (1 linha) e `cards` (N linhas) no Supabase.
 * Idempotente — pode rodar de novo sem duplicar.
 *
 * Uso: node --env-file=.env scripts/seed-set.js <tcgdex_id>
 * Ex:  node --env-file=.env scripts/seed-set.js me02.5
 *
 * Requer no ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TCGDEX_API = 'https://api.tcgdex.net/v2/pt'
const BATCH_SIZE = 8
const BATCH_DELAY_MS = 300

// Único dado que a API não expõe pronto para nossa tabela: o prefixo de ID
// de carta (convenção interna). Tudo mais (nome, total, data, raridade) vem
// direto da TCGdex — adicionar um set futuro só exige uma entrada aqui.
const ID_PREFIX_BY_SET = {
  'me02.5': 'me025',
  'me03':   'me03',
  'me04':   'me04',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`)
  return res.json()
}

async function fetchCardsInBatches(cardIds) {
  const details = []
  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(id =>
        fetchJson(`${TCGDEX_API}/cards/${id}`).catch(e => {
          console.warn(`  ⚠ falha em ${id}: ${e.message}`)
          return null
        })
      )
    )
    details.push(...results.filter(Boolean))
    console.log(`  ${Math.min(i + BATCH_SIZE, cardIds.length)}/${cardIds.length} cartas`)
    if (i + BATCH_SIZE < cardIds.length) await sleep(BATCH_DELAY_MS)
  }
  return details
}

async function seed(tcgdexId) {
  const idPrefix = ID_PREFIX_BY_SET[tcgdexId]
  if (!idPrefix) {
    console.error(`Set "${tcgdexId}" não está em ID_PREFIX_BY_SET. Adicione uma entrada antes de rodar.`)
    process.exit(1)
  }

  console.log(`Buscando set ${tcgdexId} na TCGdex...`)
  const setData = await fetchJson(`${TCGDEX_API}/sets/${tcgdexId}`)
  console.log(`${setData.name} — ${setData.cards.length} cartas`)

  console.log('Buscando detalhes (raridade) de cada carta...')
  const details = await fetchCardsInBatches(setData.cards.map(c => c.id))

  const cardRows = details.map(c => ({
    id: `${idPrefix}-${c.localId.padStart(3, '0')}`,
    name: c.name,
    number: c.localId.padStart(3, '0'),
    set_code: tcgdexId,
    nationality: 'PT-BR',
    rarity: c.rarity || null,
    image_url: c.image ? `${c.image}/high.webp` : '',
  }))

  const setRow = {
    id: tcgdexId,
    tcgdex_id: tcgdexId,
    pokemontcg_id: null,
    id_prefix: idPrefix,
    name: setData.name,
    serie: setData.serie?.name || null,
    total: setData.cardCount?.total || cardRows.length,
    release_date: setData.releaseDate || null,
    symbol_url: setData.symbol || null,
    ativo: true,
  }

  console.log('Gravando set no Supabase...')
  const { error: setError } = await supabase.from('sets').upsert(setRow, { onConflict: 'id' })
  if (setError) { console.error('Erro ao gravar set:', setError.message); process.exit(1) }

  console.log(`Gravando ${cardRows.length} cartas no Supabase...`)
  const { error: cardsError } = await supabase.from('cards').upsert(cardRows, { onConflict: 'id' })
  if (cardsError) { console.error('Erro ao gravar cartas:', cardsError.message); process.exit(1) }

  console.log(`✓ ${setData.name}: set + ${cardRows.length} cartas gravados com sucesso!`)
}

const tcgdexId = process.argv[2]
if (!tcgdexId) {
  console.error('Uso: node --env-file=.env scripts/seed-set.js <tcgdex_id>')
  console.error('Sets disponíveis:', Object.keys(ID_PREFIX_BY_SET).join(', '))
  process.exit(1)
}

seed(tcgdexId).catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check scripts/seed-set.js`
Expected: sem output

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-set.js
git commit -m "$(cat <<'EOF'
feat: script de seed via TCGdex API

node --env-file=.env scripts/seed-set.js <tcgdex_id> busca um set
completo (nome/raridade/imagem PT-BR) e faz upsert idempotente em
sets+cards. Adicionar um set futuro = 1 entrada em ID_PREFIX_BY_SET
+ rodar o script.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Confirmar `.env` local tem as credenciais reais**

Run: `grep -q '^SUPABASE_SERVICE_KEY=.\+' .env && grep -q '^SUPABASE_URL=.\+' .env && echo "OK" || echo "FALTAM CREDENCIAIS"`
Expected: `OK` (se `FALTAM CREDENCIAIS`, parar aqui e pedir ao usuário para atualizar o `.env` local antes de continuar — não pedir para colar os valores no chat)

- [ ] **Step 5: Rodar o seed para Heróis Excelsos**

Run: `node --env-file=.env scripts/seed-set.js me02.5`
Expected: log de progresso terminando em `✓ Heróis Excelsos: set + 295 cartas gravados com sucesso!`

- [ ] **Step 6: Rodar o seed para Equilíbrio Perfeito**

Run: `node --env-file=.env scripts/seed-set.js me03`
Expected: `✓ Equilíbrio Perfeito: set + 124 cartas gravados com sucesso!`

- [ ] **Step 7: Rodar o seed para Caos Ascendente**

Run: `node --env-file=.env scripts/seed-set.js me04`
Expected: `✓ Caos Ascendente: set + 122 cartas gravados com sucesso!`

---

### Task 4: `api/cards.js` — expõe `sets` e usa lista dinâmica

**Files:**
- Modify: `api/cards.js`

**Interfaces:**
- Consumes: `getActiveSets(supabase)` de `api/_sets.js` (Task 2)
- Produces: resposta JSON de `GET /api/cards` ganha o campo `sets: Array<{id,name,total,...}>` — consumido por `src/pages/Pokedex.jsx` (Task 8)

- [ ] **Step 1: Editar `api/cards.js`**

Substituir o conteúdo completo por:

```js
import { createClient } from '@supabase/supabase-js'
import { getActiveSets } from './_sets.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sets = await getActiveSets(supabase)
  const setIds = sets.map(s => s.id)

  const { data: cards, error: ce } = await supabase
    .from('cards')
    .select('*')
    .in('set_code', setIds)
    .order('number')

  if (ce) return res.status(500).json({ error: ce.message })

  const { data: collection, error: cole } = await supabase
    .from('collection')
    .select('*, cards(*)')

  if (cole) return res.status(500).json({ error: cole.message })

  // Include any collection cards not already in the active sets list
  const cardIds = new Set(cards.map(c => c.id))
  for (const item of (collection || [])) {
    if (item.cards && !cardIds.has(item.cards.id)) {
      cards.push(item.cards)
      cardIds.add(item.cards.id)
    }
  }

  const { data: prices } = await supabase
    .from('price_history')
    .select('card_id, price_brl, source, date_recorded')
    .order('date_recorded', { ascending: false })

  const priceMap = {}
  for (const p of prices || []) {
    if (!priceMap[p.card_id]) priceMap[p.card_id] = p
  }

  // Histórico do valor do portfólio (últimos 180 dias) para a sparkline
  const { data: portfolio } = await supabase
    .from('portfolio_history')
    .select('snapshot_date, total_brl, cards_count')
    .order('snapshot_date', { ascending: true })
    .limit(180)

  res.json({ cards, collection, prices: priceMap, portfolio: portfolio || [], sets })
}
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check api/cards.js`
Expected: sem output

- [ ] **Step 3: Commit e push**

```bash
git add api/cards.js
git commit -m "$(cat <<'EOF'
feat: api/cards.js le sets dinamicamente e expõe no payload

Substitui .in('set_code', ['PFLpt','ME1pt']) hardcoded por lista
vinda de getActiveSets(). Resposta ganha o campo sets, consumido
pelo seletor de coleção no Pokedex.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 4: Verificar no deploy**

Aguardar o deploy do Vercel concluir (checar via `list_deployments`/`get_deployment` MCP, ou aguardar ~1min), depois:

```bash
curl -s https://<dominio-de-producao>/api/cards | python3 -c "
import json,sys
d = json.load(sys.stdin)
print('total cards:', len(d['cards']))
print('sets:', [(s['id'], s['name'], s['total']) for s in d['sets']])
"
```

Expected (após Task 3 já ter rodado): `total cards: ~938`, `sets` com 5 entradas incluindo Heróis Excelsos/Equilíbrio Perfeito/Caos Ascendente. Se o deploy falhar, checar `get_deployment_build_logs` / `get_runtime_logs` (MCP Vercel) para o erro exato.

---

### Task 5: `api/collection.js` — `id_prefix` dinâmico

**Files:**
- Modify: `api/collection.js:29-42` (dentro de `handlePost`)

**Interfaces:**
- Consumes: `getSetByCode(supabase, code)` de `api/_sets.js` (Task 2)

- [ ] **Step 1: Editar o import no topo do arquivo**

Trocar:
```js
import { createClient } from '@supabase/supabase-js'
import { checkAuth } from './_auth.js'
import { recordPortfolioSnapshot } from './_portfolio.js'
```
Por:
```js
import { createClient } from '@supabase/supabase-js'
import { checkAuth } from './_auth.js'
import { recordPortfolioSnapshot } from './_portfolio.js'
import { getSetByCode } from './_sets.js'
```

- [ ] **Step 2: Editar a lógica de `idPrefix` em `handlePost`**

Trocar:
```js
  } else {
    // Fluxo da câmera: encontrar ou criar a carta
    const idPrefix = setCode === 'ME1pt' ? 'me1' : 'pfl'
```
Por:
```js
  } else {
    // Fluxo da câmera: encontrar ou criar a carta
    const setRow = await getSetByCode(supabase, setCode)
    const idPrefix = setRow?.id_prefix || setCode.toLowerCase().replace(/[^a-z0-9]/g, '')
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check api/collection.js`
Expected: sem output

- [ ] **Step 4: Commit e push**

```bash
git add api/collection.js
git commit -m "$(cat <<'EOF'
feat: api/collection.js resolve id_prefix via tabela sets

Substitui idPrefix hardcoded (ME1pt->me1, resto->pfl) por leitura
de sets.id_prefix, com fallback derivado do proprio setCode caso o
set nao esteja cadastrado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 5: Verificar no deploy**

Não há como testar o fluxo de câmera real sem uma foto — verificar apenas que o build/deploy não quebrou:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<dominio-de-producao>/api/collection -H "Content-Type: application/json" -d '{}'
```

Expected: `401` (sem header `x-app-secret`) ou `400`/`404` se `APP_SECRET` não estiver configurada — qualquer resposta HTTP válida confirma que a function não quebrou no deploy (não deve dar 500 de erro de sintaxe/import).

---

### Task 6: `api/price.js` — `pokemontcg_id` dinâmico

**Files:**
- Modify: `api/price.js` (topo do arquivo + função `fetchTcgPrice`)

**Interfaces:**
- Consumes: `getSetByCode(supabase, code)` de `api/_sets.js` (Task 2)

- [ ] **Step 1: Adicionar client Supabase e import do helper**

Trocar as primeiras linhas:
```js
export const maxDuration = 30

import { checkAuth, rateLimit } from './_auth.js'
```
Por:
```js
export const maxDuration = 30

import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { getSetByCode } from './_sets.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
```

- [ ] **Step 2: Substituir o `setMap` hardcoded**

Trocar:
```js
async function fetchTcgPrice(cardName, setCode) {
  const setMap = { PFLpt: 'me2', pflpt: 'me2', ME2: 'me2', ME1pt: 'me1', me1pt: 'me1', ME1: 'me1' }
  const apiSetId = setMap[setCode] || setMap[setCode?.toLowerCase()] || 'me2'
```
Por:
```js
async function fetchTcgPrice(cardName, setCode) {
  const setRow = await getSetByCode(supabase, setCode)
  const apiSetId = setRow?.pokemontcg_id || 'me2'
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check api/price.js`
Expected: sem output

- [ ] **Step 4: Commit e push**

```bash
git add api/price.js
git commit -m "$(cat <<'EOF'
feat: api/price.js resolve pokemontcg_id via tabela sets

Substitui o setMap local (2 entradas hardcoded) por leitura de
sets.pokemontcg_id. Sets sem esse campo (os 3 novos, por ora) caem
no fallback 'me2' e simplesmente nao encontram preco USD.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 5: Verificar no deploy**

```bash
curl -s -X POST https://<dominio-de-producao>/api/price \
  -H "Content-Type: application/json" -H "x-app-secret: <seu APP_SECRET>" \
  -d '{"cardName":"Charizard ex","setCode":"PFLpt"}'
```

Expected: JSON com `{"price": <número>, "source": "tcgapi_usd"}` (preço de uma carta que existe no set — confirma que a busca de `pokemontcg_id` funcionou e o comportamento de preço não regrediu para os sets legados).

---

### Task 7: `api/identify.js` — prompt dinâmico

**Files:**
- Modify: `api/identify.js` (arquivo inteiro)

**Interfaces:**
- Consumes: `getActiveSets(supabase)` de `api/_sets.js` (Task 2)

- [ ] **Step 1: Substituir o conteúdo completo de `api/identify.js`**

```js
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { getActiveSets } from './_sets.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ~6MB de base64 ≈ 4.5MB de imagem — muito acima do que uma foto de carta precisa
const MAX_IMAGE_BASE64 = 6_000_000

function buildSetRules(sets) {
  if (sets.length === 0) return '  * se não conseguir determinar → "PFLpt"'
  const lines = sets.map(s => `  * total = ${s.total} → "${s.id}"  (${s.name})`)
  const fallback = sets.find(s => s.id === 'PFLpt') || sets[0]
  lines.push(`  * se não conseguir ler o total → "${fallback.id}"`)
  return lines.join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  if (!rateLimit(req, res, { limit: 10, windowMs: 60_000 })) return

  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'Imagem obrigatória' })
  if (typeof image !== 'string' || image.length > MAX_IMAGE_BASE64) {
    return res.status(413).json({ error: 'Imagem muito grande' })
  }

  try {
    const sets = await getActiveSets(supabase)
    const setRules = buildSetRules(sets)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `Analise esta carta Pokémon TCG (pode ser Pokémon, Treinador ou Energia) e extraia as informações em JSON.

Regras:
- name: nome completo da carta como aparece impressa (ex: "Genesect", "Charizard ex", "Mega Signal", "Tinkatink")
- number: número da carta no rodapé, formato "NNN/TTT" (ex: "008/094", "121/132", "096/132")
- setCode: determine pelo total impresso após a barra no número da carta:
${setRules}
- rarity: raridade em inglês (ex: "Common", "Uncommon", "Rare", "Double Rare", "Ultra Rare", "Illustration Rare")
- isValidPTBR: true se a carta estiver em português

Responda APENAS com JSON válido, sem markdown, sem explicações:
{"name":"...","number":"...","setCode":"...","rarity":"...","isValidPTBR":true}`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].text.trim()
    const data = JSON.parse(text)
    res.json(data)
  } catch (e) {
    console.error('Vision error:', e)
    res.status(500).json({ error: 'Falha ao identificar carta' })
  }
}
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check api/identify.js`
Expected: sem output

- [ ] **Step 3: Verificar a lógica de `buildSetRules` isoladamente**

Run:
```bash
node --input-type=module -e '
function buildSetRules(sets) {
  if (sets.length === 0) return "  * se não conseguir determinar → \"PFLpt\""
  const lines = sets.map(s => `  * total = ${s.total} → "${s.id}"  (${s.name})`)
  const fallback = sets.find(s => s.id === "PFLpt") || sets[0]
  lines.push(`  * se não conseguir ler o total → "${fallback.id}"`)
  return lines.join("\n")
}
const fake = [
  { id: "ME1pt", name: "Megaevolução", total: 188 },
  { id: "PFLpt", name: "Fogo Fantasmagórico", total: 130 },
  { id: "me02.5", name: "Heróis Excelsos", total: 295 },
  { id: "me03", name: "Equilíbrio Perfeito", total: 124 },
  { id: "me04", name: "Caos Ascendente", total: 122 },
]
console.log(buildSetRules(fake))
'
```

Expected: 5 linhas `total = N → "id"` seguidas de `* se não conseguir ler o total → "PFLpt"` (fallback correto mesmo com PFLpt não sendo o primeiro do array).

- [ ] **Step 4: Commit e push**

```bash
git add api/identify.js
git commit -m "$(cat <<'EOF'
feat: api/identify.js monta prompt de deteccao de set dinamicamente

Substitui as regras fixas do prompt ("total 130 -> PFLpt") por
buildSetRules(), que le os sets ativos da tabela sets. Adicionar um
set novo passa a refletir automaticamente no scanner, sem editar
este arquivo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 5: Verificar no deploy**

Não há como testar o fluxo de câmera real sem uma foto — verificar apenas que o endpoint responde corretamente à validação de entrada:

```bash
curl -s -X POST https://<dominio-de-producao>/api/identify \
  -H "Content-Type: application/json" -H "x-app-secret: <seu APP_SECRET>" \
  -d '{}'
```

Expected: `{"error":"Imagem obrigatória"}` com status 400 (confirma que a function carregou sem erro de sintaxe/import e chegou até a validação).

---

### Task 8: `src/pages/Pokedex.jsx` — seletor de set dinâmico

**Files:**
- Modify: `src/pages/Pokedex.jsx`

**Interfaces:**
- Consumes: campo `sets` retornado por `fetchAllData()` (já produzido pela Task 4)

- [ ] **Step 1: Remover o array `SETS` hardcoded**

Trocar:
```js
const SETS = [
  { code: 'all',   label: 'Todos' },
  { code: 'PFLpt', label: 'Fogo Fantasmagórico' },
  { code: 'ME1pt', label: 'Mega Evolution' },
]
```
Por: (remover o bloco inteiro — a lista de chips vira derivada do estado, ver Step 3)

- [ ] **Step 2: Adicionar estado `setsList` e capturar do `fetchAllData()`**

Trocar:
```js
  const [cards, setCards]           = useState([])
  const [collection, setCollection] = useState({})
  const [prices, setPrices]         = useState({})
  const [filter, setFilter]         = useState('Todas')
  const [loading, setLoading]       = useState(true)
  const [offline, setOffline]       = useState(false)
  const [activeSet, setActiveSet]   = useState('all')
  const [query, setQuery]           = useState('')
  const [sortIdx, setSortIdx]       = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { cards: allCards, collection: col, prices: priceMap, offline: isOffline } = await fetchAllData()
      setCards(allCards || [])
      const map = {}
      for (const item of (col || [])) map[item.card_id] = item
      setCollection(map)
      setPrices(priceMap || {})
      setOffline(!!isOffline)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
```
Por:
```js
  const [cards, setCards]           = useState([])
  const [collection, setCollection] = useState({})
  const [prices, setPrices]         = useState({})
  const [setsList, setSetsList]     = useState([])
  const [filter, setFilter]         = useState('Todas')
  const [loading, setLoading]       = useState(true)
  const [offline, setOffline]       = useState(false)
  const [activeSet, setActiveSet]   = useState('all')
  const [query, setQuery]           = useState('')
  const [sortIdx, setSortIdx]       = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { cards: allCards, collection: col, prices: priceMap, offline: isOffline, sets: setsData } = await fetchAllData()
      setCards(allCards || [])
      const map = {}
      for (const item of (col || [])) map[item.card_id] = item
      setCollection(map)
      setPrices(priceMap || {})
      setSetsList(setsData || [])
      setOffline(!!isOffline)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Derivar a lista de chips a partir de `setsList`**

Adicionar logo antes do `return (` do componente (após o bloco de `sorted`):
```js
  const setChips = [
    { code: 'all', label: 'Todos' },
    ...setsList.map(s => ({ code: s.id, label: s.name })),
  ]
```

- [ ] **Step 4: Trocar a renderização do seletor de set**

Trocar:
```js
        <div className="flex gap-2 overflow-x-auto scroll-hide -mx-5 px-5">
          {SETS.map(s => (
```
Por:
```js
        <div className="flex gap-2 overflow-x-auto scroll-hide -mx-5 px-5">
          {setChips.map(s => (
```

- [ ] **Step 5: Atualizar o comentário/valor do fallback `TOTAL`**

Trocar:
```js
// Fallback caso o catálogo ainda não tenha carregado (130 PFLpt + 188 ME1pt)
const TOTAL = 318
```
Por:
```js
// Fallback caso o catálogo ainda não tenha carregado (soma dos 5 sets ativos)
const TOTAL = 859
```

- [ ] **Step 6: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>` e nenhum erro novo de lint (os 2 warnings pré-existentes de `react-hooks/exhaustive-deps` continuam, isso é esperado — não fazem parte deste plano)

- [ ] **Step 7: Verificar no preview**

Usar `preview_start` (se não estiver rodando), depois:
- `preview_eval`: `localStorage.removeItem('pokedex-data-v1')` (limpar qualquer cache de teste antigo) e recarregar
- `preview_snapshot` na rota `/pokedex`: confirmar 6 chips (`Todos` + 5 sets) quando a API real (com dado seedado) responder; se a API ainda não tiver sido seedada em produção neste ponto, os chips vão refletir só os sets que já existirem — isso é esperado dado o preview aponta pro Vite local que chama a API de produção

- [ ] **Step 8: Commit**

```bash
git add src/pages/Pokedex.jsx
git commit -m "$(cat <<'EOF'
feat: Pokedex.jsx consome sets da API em vez de array local

Seletor de set (chips) passa a refletir os sets ativos retornados
por /api/cards, permitindo os 3 sets novos aparecerem sem editar
este arquivo. Fallback TOTAL atualizado de 318 para 859.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `src/pages/Dashboard.jsx` — atualizar fallback

**Files:**
- Modify: `src/pages/Dashboard.jsx:10-11`

**Interfaces:**
- Nenhuma — `cards.length` (já usado hoje) reflete o total real automaticamente assim que os dados carregam; só o comentário/valor do fallback pré-load precisa de atualização

- [ ] **Step 1: Editar o comentário e valor do fallback**

Trocar:
```js
// Fallback caso o catálogo ainda não tenha carregado (130 PFLpt + 188 ME1pt)
const FALLBACK_TOTAL = 318
```
Por:
```js
// Fallback caso o catálogo ainda não tenha carregado (soma dos 5 sets ativos)
const FALLBACK_TOTAL = 859
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | grep -E "built in|error"`
Expected: `✓ built in <tempo>`

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "$(cat <<'EOF'
chore: atualiza fallback de total de cartas para 859

cards.length ja reflete o total real assim que os dados carregam;
o fallback so cobre o instante antes do primeiro load.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Verificação end-to-end e push final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Push de tudo que ainda não foi enviado**

```bash
git push origin main
```

- [ ] **Step 2: Confirmar deploy no Vercel**

Usar as ferramentas MCP da Vercel (`list_deployments` com o `projectId` de `.vercel/project.json`) para achar o deployment mais recente e seu domínio; se `get_deployment` indicar erro, inspecionar `get_deployment_build_logs` com `errorsOnly: true`.

- [ ] **Step 3: Verificar o payload completo de `/api/cards`**

```bash
curl -s https://<dominio-de-producao>/api/cards | python3 -c "
import json,sys
d = json.load(sys.stdin)
assert len(d['sets']) == 5, f\"esperado 5 sets, veio {len(d['sets'])}\"
assert len(d['cards']) >= 859, f\"esperado >=859 cards, veio {len(d['cards'])}\"
print('OK —', len(d['sets']), 'sets,', len(d['cards']), 'cards')
for s in d['sets']:
    print(' ', s['id'], '-', s['name'], '-', s['total'])
"
```

Expected: `OK — 5 sets, 859 cards` (ou mais, se o usuário já tiver cartas manuscritas fora do catálogo) seguido da lista dos 5 sets.

- [ ] **Step 4: Confirmar que os dados existentes não foram tocados**

```bash
curl -s https://<dominio-de-producao>/api/cards | python3 -c "
import json,sys
d = json.load(sys.stdin)
pfl = [c for c in d['cards'] if c['set_code']=='PFLpt']
me1 = [c for c in d['cards'] if c['set_code']=='ME1pt']
print('PFLpt:', len(pfl), '(esperado 130)')
print('ME1pt:', len(me1), '(esperado 188)')
"
```

Expected: `PFLpt: 130`, `ME1pt: 188` — confirma zero migração/regressão nos 2 sets originais.

- [ ] **Step 5: Verificar visualmente no preview**

- `preview_start` (ou reusar se já rodando)
- `preview_resize` para `mobile`
- Navegar para `/pokedex`, `preview_screenshot`: confirmar 6 chips de set visíveis e progresso calculado por set ao trocar de chip
- Navegar para `/` (Dashboard), `preview_screenshot`: confirmar "Cartas: X de 859" (ou o total real de cartas cadastradas)

- [ ] **Step 6: Atualizar a memória do projeto**

Registrar em `/Users/caueveroneze/.claude/projects/-Users-caueveroneze-Pokedex/memory/project-pokedex.md` que a Fase 1 do plano de coleções adicionais foi concluída: 5 sets ativos, 859 cartas no catálogo, arquitetura config-driven via tabela `sets`.

---

## Self-Review

**Cobertura do spec:** todos os 6 pontos hardcoded do spec (`api/cards.js`, `api/identify.js`, `api/price.js`, `api/collection.js`, `Pokedex.jsx`, `Dashboard.jsx`) têm task correspondente (Tasks 4-9). Schema (Task 1), helper compartilhado (Task 2) e seed script (Task 3) cobrem a fundação. Verificação end-to-end (Task 10) fecha o ciclo.

**Placeholders:** nenhum encontrado — todo código é completo e real, testado contra a API TCGdex ao vivo durante o brainstorming (endpoints, campos, formato de imagem).

**Consistência de tipos:** `getActiveSets`/`getSetByCode` usados identicamente em todas as 4 tasks que os consomem (Tasks 4, 5, 6, 7) — mesma assinatura, mesmo import path `./_sets.js`. `id_prefix` (schema) ↔ `idPrefix` (JS) mapeados consistentemente nas Tasks 1, 3, 5. `sets` no payload de `/api/cards` (Task 4) consumido como `sets: setsData` em `fetchAllData()` (Task 8) — mesmo nome de campo.

**Desvio do spec original (documentado):** o spec mencionava "script Node, roda manualmente" sem detalhar autenticação — a Task 3 usa `node --env-file=.env`, descoberto durante o planejamento como a forma nativa do Node 20 de carregar env vars sem dependência extra. O spec também dizia "Dashboard soma sets.total" — na prática `cards.length` (já existente no código) cumpre exatamente essa função sem mudança de lógica, só o valor do fallback precisou de atualização (Task 9). Ambos os ajustes preservam a intenção do spec com menos código.
