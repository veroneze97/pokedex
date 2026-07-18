# Preço via TCGdex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a Pokémon TCG API pela TCGdex como fonte de preço de cartas (TCGplayer/USD embutido no card da TCGdex), cobrindo também os 4 sets novos que hoje nunca tiveram preço automático.

**Architecture:** Cada carta ganha uma coluna `tcgdex_card_id` (o ID real usado pela TCGdex, gravado no seed e num backfill único para os sets já existentes) — isso evita ter que adivinhar o formato do ID por set (varia entre sets clássicos e sets "me"/Pocket). `api/price.js` passa a resolver a carta por `number`+`setCode`, ler esse ID, buscar `GET api.tcgdex.net/v2/en/cards/{id}` e extrair o preço via um helper puro testável (`api/_tcgdexPricing.js`). Client e call sites trocam `cardName` por `number` na chamada de preço.

**Tech Stack:** Node.js (Vercel Functions), Supabase (Postgres), `node --test` para o helper puro.

## Global Constraints

- Fonte de preço: TCGplayer (USD), variante `normal` preferida; se a carta não tiver variante `normal`, usa a primeira variante da lista; dentro do objeto `pricing.tcgplayer` da variante escolhida, usa o campo `marketPrice` de `normal`, senão do primeiro tipo presente com `marketPrice > 0`.
- Conversão USD→BRL: reaproveita a função `getUsdBrlRate()` já existente em `api/price.js` (AwesomeAPI, cache de 1h) — não recriar.
- Sem preço disponível (carta sem `tcgdex_card_id` ou sem `marketPrice` em nenhuma variante) → resposta 404, igual ao comportamento atual (cai no fallback de preço manual já existente no CardDetail).
- Fora de escopo: `src/services/tcgApi.js` (`searchCard`/`getSetCards`) continua na Pokémon TCG API — usado só para imagem/raridade oficial na tela de confirmação da Camera, problema separado.
- Remove por completo: `sets.pokemontcg_id` (coluna) e toda lógica de busca por nome na Pokémon TCG API dentro de `api/price.js`.

---

### Task 1: Migration — nova coluna `cards.tcgdex_card_id`

**Files:**
- Create: `migrations/20260718_cards_tcgdex_card_id.sql`
- Modify: `supabase-schema.sql:2-10` (bloco `CREATE TABLE cards`, só documentação/comentário)

**Interfaces:**
- Produces: coluna `cards.tcgdex_card_id TEXT` (nullable), usada pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Escrever a migration**

```sql
-- migrations/20260718_cards_tcgdex_card_id.sql
-- ID real da carta na TCGdex (ex: 'me04-004' ou 'swsh3-4') — usado pra buscar
-- preço via api.tcgdex.net. Nullable: cartas sem correspondência (raro) caem
-- no fallback de preço manual já existente, sem quebrar nada.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_card_id TEXT;
```

- [ ] **Step 2: Atualizar o comentário do schema de referência**

Em `supabase-schema.sql`, no bloco `CREATE TABLE IF NOT EXISTS cards (...)` (linhas 2-10), adicione a coluna documentada (schema de referência, não roda automaticamente — só documenta o estado atual do banco):

```sql
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
```

- [ ] **Step 3: Pedir para o usuário rodar a migration no Supabase**

Diga ao usuário: "Rode isto no SQL Editor do Supabase antes de eu continuar: `ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgdex_card_id TEXT;`" — e espere a confirmação antes de prosseguir para a Task seguinte (o MCP do Supabase não enxerga este projeto; migrations sempre são manuais, ver `README.md`/memória do projeto).

- [ ] **Step 4: Commit**

```bash
git add migrations/20260718_cards_tcgdex_card_id.sql supabase-schema.sql
git commit -m "feat: adiciona coluna cards.tcgdex_card_id para busca de preco na TCGdex"
```

---

### Task 2: Helper puro de extração de preço (`api/_tcgdexPricing.js`)

**Files:**
- Create: `api/_tcgdexPricing.js`
- Test: `test/tcgdexPricing.test.js`

**Interfaces:**
- Produces: `export function pickTcgplayerPrice(variantsDetailed: Array): number | null` — usada pela Task 4 (`api/price.js`).
- Consumes: nada (task independente, lógica pura).

- [ ] **Step 1: Escrever os testes**

```js
// test/tcgdexPricing.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickTcgplayerPrice } from '../api/_tcgdexPricing.js'

test('retorna marketPrice da variante normal quando presente', () => {
  const variants = [
    {
      type: 'normal',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          normal: { marketPrice: 0.11, lowPrice: 0.01 },
          'reverse-holofoil': { marketPrice: 0.36 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 0.11)
})

test('usa a primeira variante quando nao ha variante normal', () => {
  const variants = [
    {
      type: 'reverse-holofoil',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          'reverse-holofoil': { marketPrice: 0.36 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 0.36)
})

test('dentro da variante escolhida, cai pro primeiro tipo com marketPrice se nao houver normal', () => {
  const variants = [
    {
      type: 'normal',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          holofoil: { marketPrice: 4.2 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 4.2)
})

test('retorna null quando nao ha pricing.tcgplayer', () => {
  const variants = [{ type: 'normal', pricing: {} }]
  assert.equal(pickTcgplayerPrice(variants), null)
})

test('retorna null quando variantsDetailed esta vazio ou ausente', () => {
  assert.equal(pickTcgplayerPrice([]), null)
  assert.equal(pickTcgplayerPrice(undefined), null)
  assert.equal(pickTcgplayerPrice(null), null)
})

test('retorna null quando marketPrice e zero ou negativo em todos os tipos', () => {
  const variants = [
    {
      type: 'normal',
      pricing: { tcgplayer: { unit: 'USD', normal: { marketPrice: 0 } } },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), null)
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test test/tcgdexPricing.test.js`
Expected: FAIL — `Cannot find module '../api/_tcgdexPricing.js'`

- [ ] **Step 3: Implementar o helper**

```js
// api/_tcgdexPricing.js
// Extrai o preço de mercado (TCGplayer, USD) de uma carta da TCGdex.
// Prefere a variante 'normal'; se a carta não tiver, usa a primeira da
// lista. Dentro do objeto tcgplayer da variante escolhida, prefere o tipo
// 'normal' (ex: quando a variante em si é 'reverse-holofoil' mas o objeto
// tcgplayer também lista preço 'normal'); senão usa o primeiro tipo com
// marketPrice > 0 (ex: carta só existe em holofoil).

const NON_PRICE_KEYS = new Set(['unit', 'updated'])

export function pickTcgplayerPrice(variantsDetailed) {
  if (!Array.isArray(variantsDetailed) || variantsDetailed.length === 0) return null

  const variant = variantsDetailed.find(v => v.type === 'normal') || variantsDetailed[0]
  const tcgplayer = variant?.pricing?.tcgplayer
  if (!tcgplayer) return null

  if (tcgplayer.normal?.marketPrice > 0) return tcgplayer.normal.marketPrice

  const fallbackKey = Object.keys(tcgplayer).find(
    key => !NON_PRICE_KEYS.has(key) && tcgplayer[key]?.marketPrice > 0
  )
  return fallbackKey ? tcgplayer[fallbackKey].marketPrice : null
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `node --test test/tcgdexPricing.test.js`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add api/_tcgdexPricing.js test/tcgdexPricing.test.js
git commit -m "feat: helper puro para extrair preco TCGplayer de uma carta da TCGdex"
```

---

### Task 3: `scripts/seed-set.js` grava `tcgdex_card_id`

**Files:**
- Modify: `scripts/seed-set.js:85-93`

**Interfaces:**
- Consumes: coluna `cards.tcgdex_card_id` (Task 1).
- Produces: nada consumido por outras tasks — sets seedados a partir de agora já saem com o campo preenchido.

- [ ] **Step 1: Adicionar o campo ao mapeamento de `cardRows`**

Em `scripts/seed-set.js`, troque:

```js
  const cardRows = details.map(c => ({
    id: `${idPrefix}-${c.localId.padStart(3, '0')}`,
    name: c.name,
    number: c.localId.padStart(3, '0'),
    set_code: setId,
    nationality,
    rarity: c.rarity || null,
    image_url: c.image ? `${c.image}/high.webp` : '',
  }))
```

por:

```js
  const cardRows = details.map(c => ({
    id: `${idPrefix}-${c.localId.padStart(3, '0')}`,
    name: c.name,
    number: c.localId.padStart(3, '0'),
    set_code: setId,
    nationality,
    rarity: c.rarity || null,
    image_url: c.image ? `${c.image}/high.webp` : '',
    tcgdex_card_id: c.id,
  }))
```

(`c.id` já vem no objeto retornado por `fetchJson(`${tcgdexApi}/cards/${id}`)` dentro de `fetchCardsInBatches` — é o ID nativo da TCGdex, ex: `me04-004`, sem transformação nenhuma.)

- [ ] **Step 2: Verificar rodando contra um set real**

Run: `node --experimental-websocket --env-file=.env scripts/seed-set.js me04 en`
Expected: roda sem erro (upsert idempotente — já existe, só atualiza `tcgdex_card_id` nas 122 linhas)

- [ ] **Step 3: Confirmar a coluna preenchida**

Run:
```bash
node --experimental-websocket --env-file=.env -e "
import('@supabase/supabase-js').then(async ({createClient}) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { data } = await supabase.from('cards').select('id,tcgdex_card_id').eq('set_code','me04-en').limit(3)
  console.log(data)
})
"
```
Expected: 3 linhas, cada uma com `tcgdex_card_id` no formato `me04-XXX` preenchido (não `null`)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-set.js
git commit -m "feat: seed-set.js grava tcgdex_card_id de cada carta"
```

---

### Task 4: Script de backfill para os sets já existentes

**Files:**
- Create: `scripts/backfill-tcgdex-ids.js`

**Interfaces:**
- Consumes: coluna `cards.tcgdex_card_id` (Task 1), tabela `sets` (`tcgdex_id`, `id`, `ativo`).
- Produces: nada consumido por outras tasks — script de execução única (idempotente, pode rodar de novo sem problema).

- [ ] **Step 1: Escrever o script**

```js
// scripts/backfill-tcgdex-ids.js
/**
 * Preenche cards.tcgdex_card_id para cartas já gravadas antes dessa coluna
 * existir. Busca a lista de cartas de cada set ativo na TCGdex (cada item
 * tem {id, localId}), casa pelo número (localId.padStart(3,'0') ==
 * cards.number) e grava o id nativo da TCGdex. Idempotente — pode rodar
 * de novo sem duplicar ou sobrescrever errado.
 *
 * Uso: node --experimental-websocket --env-file=.env scripts/backfill-tcgdex-ids.js
 *
 * Requer no ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`)
  return res.json()
}

async function backfillSet(set) {
  console.log(`\nSet ${set.id} (tcgdex_id=${set.tcgdex_id})...`)
  const tcgdexSet = await fetchJson(`https://api.tcgdex.net/v2/en/sets/${set.tcgdex_id}`)

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, number, tcgdex_card_id')
    .eq('set_code', set.id)
  if (error) { console.error(`  ✗ erro ao ler cartas de ${set.id}:`, error.message); return }

  const byNumber = new Map(tcgdexSet.cards.map(c => [c.localId.padStart(3, '0'), c.id]))

  let updated = 0
  let unmatched = 0
  for (const card of cards) {
    const tcgdexCardId = byNumber.get(card.number)
    if (!tcgdexCardId) { unmatched++; continue }
    if (card.tcgdex_card_id === tcgdexCardId) continue // já correto, poupa um write

    const { error: updateError } = await supabase
      .from('cards')
      .update({ tcgdex_card_id: tcgdexCardId })
      .eq('id', card.id)
    if (updateError) {
      console.error(`  ✗ erro ao atualizar ${card.id}:`, updateError.message)
      continue
    }
    updated++
  }

  console.log(`  ✓ ${updated}/${cards.length} atualizadas` + (unmatched ? `, ${unmatched} sem correspondência` : ''))
}

async function main() {
  const { data: sets, error } = await supabase.from('sets').select('id, tcgdex_id').eq('ativo', true)
  if (error) { console.error('Erro ao listar sets:', error.message); process.exit(1) }

  for (const set of sets) {
    await backfillSet(set)
  }
  console.log('\n✓ Backfill concluído.')
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Rodar contra o Supabase real**

Run: `node --experimental-websocket --env-file=.env scripts/backfill-tcgdex-ids.js`
Expected: um bloco de log por set ativo (`PFLpt`, `ME1pt`, `me02.5`, `me03`, `me04-en`, `me05-en`), cada um terminando em `✓ N/N atualizadas` (idealmente sem "sem correspondência"; se houver algumas, é esperado para cartas promo/erro de digitação raras — não é falha do script)

- [ ] **Step 3: Confirmar cobertura**

Run:
```bash
node --experimental-websocket --env-file=.env -e "
import('@supabase/supabase-js').then(async ({createClient}) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { count: total } = await supabase.from('cards').select('id', {count:'exact', head:true})
  const { count: withId } = await supabase.from('cards').select('id', {count:'exact', head:true}).not('tcgdex_card_id', 'is', null)
  console.log(\`\${withId}/\${total} cartas com tcgdex_card_id\`)
})
"
```
Expected: `withId` igual (ou muito próximo) de `total` — a maioria das cartas com o campo preenchido

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-tcgdex-ids.js
git commit -m "feat: script de backfill de tcgdex_card_id para sets ja existentes"
```

---

### Task 5: Reescreve `api/price.js` para usar a TCGdex

**Files:**
- Modify: `api/price.js` (reescrita completa do corpo, mantém `checkAuth`/`rateLimit`/`getUsdBrlRate`)

**Interfaces:**
- Consumes: `pickTcgplayerPrice` de `./_tcgdexPricing.js` (Task 2), coluna `cards.tcgdex_card_id` (Task 1/3/4).
- Produces: endpoint `POST /api/price` aceita `{ number, setCode }` (client-facing, consumido pela Task 6) e retorna `{ price, source: 'tcgdex_usd' }` ou 404.

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```js
// api/price.js
export const maxDuration = 30

import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { pickTcgplayerPrice } from './_tcgdexPricing.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) return

  const { number, setCode } = req.body
  if (!number || !setCode) return res.status(400).json({ error: 'number e setCode obrigatórios' })

  try {
    const result = await fetchTcgdexPrice(number, setCode)
    if (result) return res.json(result)
  } catch (e) {
    console.warn('TCGdex price failed:', e.message)
  }

  res.status(404).json({ error: 'Preço não encontrado' })
}

// Cotação USD→BRL com cache de 1h por instância; fallback se a API cair
let rateCache = { value: 5.75, fetchedAt: 0 }
const RATE_TTL = 60 * 60 * 1000

async function getUsdBrlRate() {
  if (Date.now() - rateCache.fetchedAt < RATE_TTL) return rateCache.value
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    if (res.ok) {
      const data = await res.json()
      const bid = parseFloat(data?.USDBRL?.bid)
      if (bid > 0) {
        rateCache = { value: bid, fetchedAt: Date.now() }
        return bid
      }
    }
  } catch (e) {
    console.warn('Cotação USD-BRL indisponível, usando último valor:', e.message)
  }
  return rateCache.value
}

async function fetchTcgdexPrice(number, setCode) {
  const { data: card, error } = await supabase
    .from('cards')
    .select('tcgdex_card_id')
    .eq('number', number)
    .eq('set_code', setCode)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!card?.tcgdex_card_id) return null

  const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.tcgdex_card_id}`)
  if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`)
  const tcgdexCard = await res.json()

  const usdPrice = pickTcgplayerPrice(tcgdexCard.variants_detailed)
  if (!usdPrice) return null

  const brlRate = await getUsdBrlRate()
  const brlPrice = Math.round(usdPrice * brlRate * 100) / 100

  return { price: brlPrice, source: 'tcgdex_usd' }
}
```

- [ ] **Step 2: Rodar o build (garante que o arquivo é sintaticamente válido e nada mais importa dele com a assinatura antiga)**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 3: Commit**

```bash
git add api/price.js
git commit -m "feat: api/price.js busca preco na TCGdex em vez da Pokemon TCG API"
```

---

### Task 6: Client — `fetchPrice(number, setCode)` e call sites

**Files:**
- Modify: `src/services/pricing.js`
- Modify: `src/pages/Dashboard.jsx` (linha da chamada `fetchPrice` dentro de `handleUpdatePrices`)
- Modify: `src/pages/Camera.jsx` (linha da chamada `fetchPrice` dentro de `processImage`)

**Interfaces:**
- Consumes: endpoint `POST /api/price` com body `{ number, setCode }` (Task 5).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Atualizar `src/services/pricing.js`**

Troque:

```js
import { apiFetch } from './http'

export async function fetchPrice(cardName, setCode) {
  const res = await apiFetch('/api/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardName, setCode }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data // { price, source }
}
```

por:

```js
import { apiFetch } from './http'

export async function fetchPrice(number, setCode) {
  const res = await apiFetch('/api/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, setCode }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data // { price, source }
}
```

- [ ] **Step 2: Atualizar a chamada em `src/pages/Dashboard.jsx`**

Dentro de `handleUpdatePrices`, troque:

```js
            const result = await fetchPrice(card.name, card.set_code)
```

por:

```js
            const result = await fetchPrice(card.number, card.set_code)
```

(`card` aqui é `item.cards` — já tem `.number` zero-padded vindo direto do catálogo, sem transformação extra necessária.)

- [ ] **Step 3: Atualizar a chamada em `src/pages/Camera.jsx`**

Dentro de `processImage`, troque:

```js
      Promise.allSettled([
        searchCard(result.number, result.setCode),
        fetchPrice(result.name, result.setCode),
      ]).then(([tcg, priceRes]) => {
```

por:

```js
      Promise.allSettled([
        searchCard(result.number, result.setCode),
        fetchPrice(result.number.split('/')[0].padStart(3, '0'), result.setCode),
      ]).then(([tcg, priceRes]) => {
```

(`result.number` vem da identificação por IA no formato `"008/094"` — a mesma normalização já usada mais abaixo no arquivo, em `handleConfirm`, para gravar a carta na coleção.)

- [ ] **Step 4: Rodar o build**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing.js src/pages/Dashboard.jsx src/pages/Camera.jsx
git commit -m "feat: fetchPrice passa a buscar por numero da carta em vez do nome"
```

---

### Task 7: Remove `sets.pokemontcg_id`

**Files:**
- Create: `migrations/20260718_sets_drop_pokemontcg_id.sql`
- Modify: `supabase-schema.sql` (bloco `CREATE TABLE sets` e o `INSERT` dos 2 sets legados)
- Modify: `scripts/seed-set.js` (remove `pokemontcg_id: null` do `setRow`)
- Modify: `README.md:8` e `README.md:59`

**Interfaces:**
- Consumes: nada de tasks anteriores (a Task 5 já não lê `pokemontcg_id`, então essa remoção é segura a essa altura do plano).
- Produces: nada consumido por outras tasks — é a última.

- [ ] **Step 1: Escrever a migration**

```sql
-- migrations/20260718_sets_drop_pokemontcg_id.sql
-- Preço agora vem da TCGdex (api/_tcgdexPricing.js + cards.tcgdex_card_id),
-- não mais da Pokémon TCG API — pokemontcg_id não é lido em lugar nenhum
-- do código a partir desta mudança.

ALTER TABLE sets DROP COLUMN IF EXISTS pokemontcg_id;
```

- [ ] **Step 2: Pedir para o usuário rodar a migration**

Diga ao usuário: "Rode isto no SQL Editor do Supabase: `ALTER TABLE sets DROP COLUMN IF EXISTS pokemontcg_id;`" — espere confirmação antes do próximo step.

- [ ] **Step 3: Atualizar `supabase-schema.sql`**

No bloco `CREATE TABLE IF NOT EXISTS sets (...)`, remova a linha:

```sql
  pokemontcg_id TEXT,                   -- ID no pokemontcg.io, usado só para preço USD (nullable)
```

E no `INSERT INTO sets (...)` dos 2 sets legados, logo abaixo, remova a coluna `pokemontcg_id` e os valores `'me2'`/`'me1'` da lista (mantendo os demais valores na mesma ordem):

```sql
INSERT INTO sets (id, tcgdex_id, id_prefix, name, serie, total, release_date) VALUES
  ('PFLpt', 'me02', 'pfl', 'Fogo Fantasmagórico', 'Megaevolução', 130, NULL),
  ('ME1pt', 'me01', 'me1', 'Megaevolução',        'Megaevolução', 188, NULL)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Remover `pokemontcg_id` de `scripts/seed-set.js`**

Troque:

```js
  const setRow = {
    id: setId,
    tcgdex_id: tcgdexId,
    pokemontcg_id: null,
    id_prefix: idPrefix,
```

por:

```js
  const setRow = {
    id: setId,
    tcgdex_id: tcgdexId,
    id_prefix: idPrefix,
```

- [ ] **Step 5: Atualizar `README.md`**

Troque a linha 8:

```
- 💰 **Preços automáticos** — busca na Pokémon TCG API com conversão USD→BRL pela cotação do dia (AwesomeAPI, cache de 1h)
```

por:

```
- 💰 **Preços automáticos** — busca na TCGdex (TCGplayer/USD) com conversão USD→BRL pela cotação do dia (AwesomeAPI, cache de 1h)
```

Troque a linha 59:

```
  price.js               POST preço via Pokémon TCG API (cotação dinâmica)
```

por:

```
  price.js               POST preço via TCGdex/TCGplayer (cotação dinâmica)
```

- [ ] **Step 6: Rodar o build e os testes**

Run: `npm run build && node --test`
Expected: build sem erro; testes passam (incluindo os 6 novos de `tcgdexPricing.test.js`)

- [ ] **Step 7: Commit**

```bash
git add migrations/20260718_sets_drop_pokemontcg_id.sql supabase-schema.sql scripts/seed-set.js README.md
git commit -m "chore: remove pokemontcg_id, preco agora vem so da TCGdex"
```

---

## Verificação final (todas as tasks aplicadas)

1. `npm run build && node --test` — build limpo, todos os testes passando.
2. Em produção (após deploy): abrir o Dashboard, clicar "Atualizar Preços", confirmar que cartas de **Chaos Rising** e **Pitch Black** (que hoje não têm preço nenhum) passam a receber valor.
3. Confirmar que os 2 sets legados (Fogo Fantasmagórico, Megaevolução) continuam recebendo preço normalmente — não regride.
4. Escanear uma carta nova pela Câmera e confirmar que o preço aparece na tela de confirmação antes de salvar (mesmo fluxo de hoje, só a fonte mudou).
