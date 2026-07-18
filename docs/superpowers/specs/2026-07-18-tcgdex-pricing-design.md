# Preço via TCGdex (substitui a Pokémon TCG API)

## Contexto

`api/price.js` hoje busca preço na Pokémon TCG API (`api.pokemontcg.io`), resolvendo o set via `sets.pokemontcg_id`. Isso só cobre os 2 sets legados (PFLpt/ME1pt) — os 4 sets novos (Ascended Heroes/me02.5, Perfect Order/me03, Chaos Rising/me04-en, Pitch Black/me05-en) têm `pokemontcg_id = null` e nunca teriam preço automático, porque não existem na Pokémon TCG API (são sets de Pokémon TCG Pocket).

A TCGdex (já usada pelo catálogo — nomes, imagens, raridade) também expõe preço por carta, de graça e sem chave de API: cada carta tem `variants_detailed[].pricing.tcgplayer` (mercado americano, USD) e `.pricing.cardmarket` (mercado europeu, EUR) — confirmado presente inclusive nos sets "me" que hoje não têm preço nenhum.

## Escopo

Substitui **só** o fluxo de preço (`api/price.js`, `src/services/pricing.js`, chamadas em `Dashboard.jsx`/`Camera.jsx`). Não mexe em `searchCard`/`tcgApi.js` (usado no Camera para buscar imagem/raridade oficial na confirmação — segue outro problema, fora deste escopo). Remove completamente a Pokémon TCG API do fluxo de preço e a coluna `sets.pokemontcg_id`.

## Descoberta que molda o design

O ID de carta na TCGdex não segue um formato único: sets "me" (Pocket) usam número com zero à esquerda (`me04-004`), sets clássicos não usam (`swsh3-4`). Não dá pra reconstruir o ID a partir do nosso `cards.number` (sempre zero-padded) sem arriscar 404. Por isso, o design grava o ID real da TCGdex por carta em vez de tentar adivinhar.

## Mudanças

### 1. Nova coluna `cards.tcgdex_card_id`

`ALTER TABLE cards ADD COLUMN tcgdex_card_id TEXT;` (nullable — cartas sem preço disponível não quebram nada, caem no fallback de preço manual já existente).

### 2. `scripts/seed-set.js` grava o ID real

O script já busca o detalhe de cada carta na TCGdex (`fetchCardsInBatches`), e cada resultado já tem `c.id` (o ID nativo, ex: `me04-004`). Passa a incluir esse valor em `cardRows`. Novos sets seedados a partir de agora já saem com o campo preenchido — zero trabalho extra futuro.

### 3. Script de backfill (`scripts/backfill-tcgdex-ids.js`)

Roda uma vez pros 6 sets já existentes (2 legados + me02.5 + me03 + me04-en + me05-en). Para cada set ativo: busca `GET /v2/en/sets/{tcgdex_id}` (lista de `{id, localId}`), casa cada carta pelo `localId.padStart(3,'0')` contra `cards.number`, grava `tcgdex_card_id = id`. Sets sem correspondência (raro, cartas promo/erro de digitação) ficam `null` e são reportados no log — não travam o script.

### 4. `api/price.js` reescrito

- Recebe `POST { number, setCode }` (em vez de `{ cardName, setCode }`).
- Busca a carta em `cards` por `number` + `set_code` (já é `UNIQUE` no schema).
- Se `tcgdex_card_id` for `null` → 404 (mesmo comportamento de "sem preço" de hoje).
- `GET https://api.tcgdex.net/v2/en/cards/{tcgdex_card_id}`.
- De `variants_detailed`, prefere a variante `type === 'normal'`; se não houver, usa a primeira da lista.
- Lê `pricing.tcgplayer` dessa variante; usa `marketPrice` de `normal` se presente, senão do primeiro tipo de variante do próprio objeto `tcgplayer` (uma carta pode só ter `reverse-holofoil`, por exemplo).
- Sem preço em nenhuma variante → 404.
- Converte USD→BRL reaproveitando `getUsdBrlRate()` (AwesomeAPI, cache 1h, sem mudança).
- Retorna `{ price, source: 'tcgdex_usd' }`.
- Remove `fetchTcgPrice`/`extractPrice` (lógica da Pokémon TCG API) inteiras.

### 5. Client (`src/services/pricing.js` + call sites)

`fetchPrice(cardName, setCode)` vira `fetchPrice(number, setCode)`.

- **`Dashboard.jsx`** (`handleUpdatePrices`): troca `fetchPrice(card.name, card.set_code)` por `fetchPrice(card.number, card.set_code)` — `card.number` já vem pronto (zero-padded) do catálogo, sem transformação.
- **`Camera.jsx`** (`processImage`): troca `fetchPrice(result.name, result.setCode)` por `fetchPrice(result.number.split('/')[0].padStart(3, '0'), result.setCode)` — mesma normalização que `handleConfirm` já faz mais abaixo no arquivo pro número identificado pela Vision (que vem no formato `"008/094"`).

### 6. Remoção de `pokemontcg_id`

- `ALTER TABLE sets DROP COLUMN pokemontcg_id;`
- `scripts/seed-set.js`: remove `pokemontcg_id: null` do `setRow`.
- `README.md`: atualiza a descrição de preços automáticos (linha 8) e a linha da tabela de arquivos (linha 59) pra citar TCGdex em vez de Pokémon TCG API.

## Fora de escopo

- `searchCard`/`getSetCards` (`tcgApi.js`) continuam na Pokémon TCG API — usados só pra imagem/raridade na tela de confirmação da Camera, problema separado (já não funcionam pros sets novos hoje, de qualquer forma).
- Preço em EUR/Cardmarket — descartado nesta rodada (TCGplayer/USD escolhido).
- Seleção de variante pelo usuário (holo vs normal) — sempre pega "normal" automaticamente, sem UI pra escolher.

## Testes/verificação

Sem ambiente local pras rotas `/api/*` (só rodam na Vercel) — verificação é: 1) rodar o backfill contra o Supabase real e confirmar contagem de `tcgdex_card_id` preenchido por set; 2) após deploy, clicar "Atualizar Preços" no Dashboard em produção e conferir que cartas de Chaos Rising/Pitch Black (hoje sem preço) passam a ter valor; 3) confirmar que os 2 sets legados continuam trazendo preço (não regride).
