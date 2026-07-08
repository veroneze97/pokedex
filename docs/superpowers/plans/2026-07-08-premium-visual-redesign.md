# Redesign Visual Premium — "Palco de Revelação" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a estética de "planilha" do app (listas label→valor, containers genéricos uniformes) por uma linguagem visual premium validada com mockups: dourado como cor de marca, verde/vermelho exclusivos para sinalizar preço, e um "palco de revelação" no CardDetail (a carta respira sozinha antes dos dados, luz direcional em vez de glow difuso).

**Architecture:** Reskin incremental sobre a base existente (React 19 + Tailwind v4, tudo em classes utilitárias + estilo inline pontual). Um helper novo (`typeColors.js`) fornece o glow por tipo Pokémon nos `CardTile`; uma migration + script de backfill populam o dado de tipo (inexistente hoje) via TCGdex API. Nenhum endpoint de `api/*.js` precisa mudar — todos já fazem `select('*')`/`cards(*)`, então a coluna nova `type` flui automaticamente para o frontend assim que existir.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4 (classes utilitárias, sem novos tokens em `@theme` — o app usa hex arbitrário direto nas classes, ex: `bg-[#101014]`, convenção que este plano mantém), Supabase (Postgres), TCGdex API (`api.tcgdex.net/v2/pt`).

## Global Constraints

- Este projeto não tem test runner configurado (sem Jest/Vitest). Verificação por task = `node --check` (sintaxe de scripts/API), `npm run build`, `npm run lint`, e as ferramentas `preview_*` contra o dev server local. Este é o padrão já estabelecido no repo (confirmado no plano anterior, `docs/superpowers/plans/2026-07-08-sets-table.md`).
- Migration SQL deve ser aplicada **manualmente pelo usuário** no SQL Editor do Supabase — sem acesso MCP a este projeto.
- Scripts Node locais usam `node --experimental-websocket --env-file=.env` (obrigatório: `@supabase/supabase-js` quebra em Node 20 local sem essa flag — ver memória do projeto).
- Trabalho direto na branch `main`, sem worktree — preferência confirmada do usuário para este projeto pessoal solo.
- Cor verde (`#00E676`) e vermelha (`#FF3B30`) ficam **exclusivas** para sinalizar variação de preço/P&L real (badges de alta/baixa, resultado de P&L, seção "Valorizaram" do relatório de atualização). Todo uso hoje **decorativo** dessas cores (preço de carta sem contexto de variação, % de progresso de coleção, linha de gráfico, sparkline do Dashboard, barra de progresso de atualização de preços) migra para dourado (`#F5A623`) neste plano — mapeamento completo abaixo.
- `Camera.jsx` fica **fora de escopo** — nenhuma mudança visual, conforme aprovado no spec.
- Cor por tipo Pokémon é usada **apenas** no glow de borda dos `CardTile` (grade da Coleção e carrossel "Mais Valiosas" do Dashboard). O hero do CardDetail usa **sempre** o glow dourado fixo (validado explicitamente nos mockups — variante "glow por tipo" foi descartada para essa tela).

## File Structure

**Create:**
- `src/utils/typeColors.js` — mapa de cor por tipo Pokémon + `getTypeGlow(type)` (retorna `{ boxShadow }` para uso inline)
- `scripts/backfill-types.js` — popula `cards.type` via TCGdex API, reaproveitando o padrão de `scripts/seed-set.js`

**Modify:**
- `supabase-schema.sql` — nova coluna `type` em `cards`
- `src/index.css` — keyframes `holo-sheen`/`bob`, classe `.holo-sheen`, cor do `.progress-bar` atualizada
- `src/components/Money.jsx` — prop `gold` (cor dourada sólida + glow via `text-shadow`)
- `src/components/CardTile.jsx` — glow por tipo + sheen holográfico nos itens possuídos; preço vira dourado
- `src/components/PriceChart.jsx` — linha sempre dourada, eixo min/max, tooltip por toque/arraste
- `src/components/BottomNav.jsx` — botão central ativo vira gradiente dourado
- `src/pages/Dashboard.jsx` — hero de patrimônio sem caixa, chips sem borda pesada, "Progresso" dourado, tiles do carrossel com glow, sparkline dourada, barra de progresso de atualização dourada
- `src/pages/Pokedex.jsx` — bloco de progresso sem caixa, "% completo" dourado
- `src/pages/CardDetail.jsx` — palco de revelação (hero), remove header antigo, bloco de preço sem caixa, metadados em badges (grid) em vez de lista, CTA em gradiente dourado

---

### Task 1: Migration SQL — coluna `type` em `cards`

**Files:**
- Modify: `supabase-schema.sql` (append ao final do arquivo)

**Interfaces:**
- Produces: coluna `cards.type` (TEXT, nullable) — consumida por `scripts/backfill-types.js` (Task 3) e por todo componente que renderiza `card.type` (Tasks 6, 9)

- [ ] **Step 1: Adicionar o bloco SQL ao final de `supabase-schema.sql`**

```sql

-- ── Tipo Pokémon por carta (redesign visual premium) ───────────────────────
-- Usado só para o glow de borda por tipo nos CardTiles da Coleção/Dashboard.
-- Nullable: cartas sem tipo (ainda não populado, ou tipo fora do mapa) caem
-- no glow dourado padrão — nunca quebra o layout.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS type TEXT;
```

- [ ] **Step 2: Commitar o arquivo atualizado**

```bash
git add supabase-schema.sql
git commit -m "$(cat <<'EOF'
feat: adiciona coluna type ao schema de cards

Preparacao para o glow por tipo Pokemon nos CardTiles do redesign
visual premium. Nullable e populada via scripts/backfill-types.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Aplicar a migration manualmente no Supabase**

Este step é do **usuário**: abrir o painel do Supabase → SQL Editor, colar e rodar o bloco do Step 1, confirmar sucesso.

- [ ] **Step 4: Verificar a migration**

Pedir ao usuário para rodar no SQL Editor (ou aguardar confirmação verbal):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cards' AND column_name = 'type';
```

Esperado: 1 linha, `type` / `text`.

---

### Task 2: `src/utils/typeColors.js` — mapa de cor por tipo

**Files:**
- Create: `src/utils/typeColors.js`

**Interfaces:**
- Produces: `getTypeGlow(type: string|null): { boxShadow: string }` — consumido por `CardTile.jsx` (Task 6) e `Dashboard.jsx` (Task 9)

- [ ] **Step 1: Criar `src/utils/typeColors.js`**

```js
// Cor de glow por tipo Pokémon nos CardTiles possuídos.
// Fallback: dourado (cor de marca do app) — cobre cartas sem tipo salvo
// ainda, ou tipos fora do mapa (não deve nunca quebrar o layout).

const TYPE_COLORS = {
  grama: [60, 199, 120],
  fogo: [255, 90, 64],
  agua: [56, 150, 255],
  eletrico: [240, 200, 40],
  psiquico: [147, 112, 246],
  lutador: [200, 110, 50],
  sombrio: [110, 96, 140],
  metalico: [160, 174, 190],
  fada: [244, 114, 182],
  dragao: [99, 102, 241],
  incolor: [176, 176, 176],
  // Aliases em inglês, caso a API retorne nomes não localizados
  grass: [60, 199, 120],
  fire: [255, 90, 64],
  water: [56, 150, 255],
  lightning: [240, 200, 40],
  electric: [240, 200, 40],
  psychic: [147, 112, 246],
  fighting: [200, 110, 50],
  darkness: [110, 96, 140],
  dark: [110, 96, 140],
  metal: [160, 174, 190],
  fairy: [244, 114, 182],
  dragon: [99, 102, 241],
  colorless: [176, 176, 176],
}

const GOLD_RGB = [245, 166, 35]

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function getTypeGlow(type) {
  const [r, g, b] = TYPE_COLORS[normalize(type)] || GOLD_RGB
  return {
    boxShadow: `0 0 0 1px rgba(${r},${g},${b},0.35), 0 0 20px -4px rgba(${r},${g},${b},0.55)`,
  }
}
```

- [ ] **Step 2: Verificar sintaxe e comportamento**

Run:
```bash
node --check src/utils/typeColors.js
node --input-type=module -e '
import { getTypeGlow } from "./src/utils/typeColors.js"
console.log(getTypeGlow("Água"))
console.log(getTypeGlow("fogo"))
console.log(getTypeGlow(null))
console.log(getTypeGlow("TipoQueNaoExiste"))
'
```

Expected: sem erro de sintaxe; 4 linhas de `{ boxShadow: '...' }` — as duas últimas (`null` e tipo inexistente) devem usar o RGB do dourado `245,166,35`.

- [ ] **Step 3: Commit**

```bash
git add src/utils/typeColors.js
git commit -m "$(cat <<'EOF'
feat: helper de cor por tipo Pokemon para o glow dos CardTiles

getTypeGlow(type) normaliza acentos/caixa e retorna box-shadow na
cor do tipo, com fallback dourado para cartas sem tipo salvo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `scripts/backfill-types.js` — popular `type` via TCGdex

**Files:**
- Create: `scripts/backfill-types.js`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_KEY`, tabela `sets` (via `select('*').eq('ativo', true)`)
- Produces: `cards.type` populado no Supabase — consumido pelas Tasks 6 e 9 na verificação visual (Task 12)

**Pré-requisito:** Task 1 aplicada (coluna `type` existe).

- [ ] **Step 1: Criar `scripts/backfill-types.js`**

```js
/**
 * Preenche a coluna `type` das cartas já cadastradas, usando a TCGdex API.
 * Idempotente — pode rodar de novo sem duplicar (é um UPDATE por id).
 *
 * Uso: node --experimental-websocket --env-file=.env scripts/backfill-types.js [tcgdex_id]
 * Sem argumento: roda para todos os sets ativos. Com argumento: só aquele set
 * (útil pra testar num set pequeno antes de rodar tudo).
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

async function backfillSet(set) {
  console.log(`\nSet ${set.name} (${set.tcgdex_id})...`)
  const setData = await fetchJson(`${TCGDEX_API}/sets/${set.tcgdex_id}`)
  const details = await fetchCardsInBatches(setData.cards.map(c => c.id))

  const updates = details
    .map(c => ({
      id: `${set.id_prefix}-${c.localId.padStart(3, '0')}`,
      type: Array.isArray(c.types) && c.types.length > 0 ? c.types[0] : null,
    }))
    .filter(u => u.type)

  if (updates.length === 0) {
    console.log('  Nenhum tipo encontrado neste set (confira o campo `types` da resposta da API).')
    return
  }

  console.log(`  Gravando type em ${updates.length}/${details.length} cartas...`)
  for (const u of updates) {
    const { error } = await supabase.from('cards').update({ type: u.type }).eq('id', u.id)
    if (error) console.warn(`  ⚠ falha ao atualizar ${u.id}: ${error.message}`)
  }
  console.log(`  ✓ ${set.name}: ${updates.length} cartas atualizadas`)
}

async function run() {
  const onlyTcgdexId = process.argv[2]

  const { data: sets, error } = await supabase.from('sets').select('*').eq('ativo', true)
  if (error) { console.error('Erro ao ler sets:', error.message); process.exit(1) }

  const targets = onlyTcgdexId ? sets.filter(s => s.tcgdex_id === onlyTcgdexId) : sets
  if (targets.length === 0) {
    console.error(onlyTcgdexId ? `Set "${onlyTcgdexId}" não encontrado ou inativo.` : 'Nenhum set ativo encontrado.')
    process.exit(1)
  }

  for (const set of targets) await backfillSet(set)
  console.log('\n✓ Backfill concluído.')
}

run().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check scripts/backfill-types.js`
Expected: sem output

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-types.js
git commit -m "$(cat <<'EOF'
feat: script de backfill de tipo Pokemon via TCGdex API

node --env-file=.env scripts/backfill-types.js [tcgdex_id] popula
cards.type a partir do campo `types` da TCGdex. Sem argumento roda
para todos os sets ativos; com argumento roda so um (util pra testar
antes de aplicar em tudo).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Testar num set pequeno primeiro**

Run: `node --experimental-websocket --env-file=.env scripts/backfill-types.js me03`
Expected: log de progresso terminando em `✓ Equilíbrio Perfeito: N cartas atualizadas` (N próximo de 124). **Se aparecer "Nenhum tipo encontrado neste set"**, o campo `types` da resposta da TCGdex tem outro nome — parar aqui, inspecionar manualmente com `curl -s https://api.tcgdex.net/v2/pt/cards/me03-001 | python3 -m json.tool` para achar o nome correto do campo, e ajustar `c.types` no Step 1 antes de continuar.

- [ ] **Step 5: Conferir uma amostra no Supabase**

Pedir ao usuário para rodar no SQL Editor:
```sql
SELECT id, name, type FROM cards WHERE set_code = 'me03' AND type IS NOT NULL LIMIT 10;
```
Expected: 10 linhas com `type` preenchido com valores plausíveis (ex: "Água", "Fogo", "Grama" ou os equivalentes em inglês).

- [ ] **Step 6: Rodar para todos os sets ativos**

Run: `node --experimental-websocket --env-file=.env scripts/backfill-types.js`
Expected: um bloco de log por set (5 sets), cada um terminando em `✓ <nome>: N cartas atualizadas`, seguido de `✓ Backfill concluído.`

---

### Task 4: `src/index.css` — tokens e efeitos novos

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Produces: classe `.holo-sheen` (sheen holográfico animado, absoluto, para uso dentro de containers com `position: relative` e `overflow: hidden`) e keyframe `bob` (indicador de scroll) — consumidos por `CardTile.jsx` (Task 6), `Dashboard.jsx` (Task 9) e `CardDetail.jsx` (Task 11)

- [ ] **Step 1: Atualizar a cor do `.progress-bar`**

Trocar:
```css
.progress-bar {
  background: #00E676;
  transition: width 0.6s ease;
}
```
Por:
```css
.progress-bar {
  background: #F5A623;
  transition: width 0.6s ease;
}
```

- [ ] **Step 2: Adicionar o sheen holográfico e o keyframe `bob` ao final do arquivo**

```css

/* ── Sheen holográfico: brilho diagonal animado, usado em CardTile e no
   palco do CardDetail. O elemento pai precisa de position:relative +
   overflow:hidden (ou border-radius) para o brilho ficar contido. ───────── */
@keyframes holo-sheen {
  0%, 100% { transform: translateX(-40%) translateY(-15%) rotate(8deg); }
  50%      { transform: translateX(40%) translateY(15%) rotate(8deg); }
}
.holo-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.holo-sheen::after {
  content: '';
  position: absolute;
  inset: -20%;
  background: linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.35) 38%, rgba(245,166,35,0.5) 46%, transparent 60%);
  animation: holo-sheen 4s ease-in-out infinite;
}

/* ── Indicador de scroll (palco de revelação do CardDetail) ──────────────── */
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(4px); }
}
```

- [ ] **Step 3: Verificar que o build não quebra**

Run: `npm run build 2>&1 | grep -E "built in|error"`
Expected: `✓ built in <tempo>`

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "$(cat <<'EOF'
feat: tokens de efeito do redesign premium (sheen holografico, bob)

.holo-sheen anima um brilho diagonal, usado nos CardTiles possuidos
e no palco de revelacao do CardDetail. .progress-bar troca de verde
para dourado (nao e mais sinal de preco, e progresso de colecao).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `src/components/Money.jsx` — prop `gold`

**Files:**
- Modify: `src/components/Money.jsx`

**Interfaces:**
- Produces: prop `gold?: boolean` em `<Money>` — quando `true`, o número (não o prefixo "R$") fica na cor de marca (`#F5A623`) com glow (`text-shadow`). Consumido por `Dashboard.jsx` (Task 9) e `CardDetail.jsx` (Task 11)

Nota de implementação: `color` e `text-shadow` são propriedades CSS herdadas — aplicar no `<span>` externo e deixar os dígitos (inclusive os do modo `rolling`, que são `<span>` aninhados) herdarem é suficiente e evita a armadilha de `background-clip: text` não se propagar para elementos filhos com seu próprio texto.

- [ ] **Step 1: Substituir o conteúdo completo de `src/components/Money.jsx`**

```jsx
import React, { useEffect, useState } from 'react'

// Coluna de 0–9 que rola até o dígito alvo (transição CSS em .digit-stack).
// Monta em 0 e anima até o valor — decorativo: o estado final é garantido
// pela própria transição CSS, sem depender de rAF.
function DigitCol({ digit }) {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setPos(digit), 60)
    return () => clearTimeout(t)
  }, [digit])
  return (
    <span className="digit-col">
      <span className="digit-stack" style={{ transform: `translateY(-${pos}em)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <span key={n}>{n}</span>)}
      </span>
    </span>
  )
}

// Tipografia de dinheiro: "R$" menor e secundário, centavos reduzidos,
// tracking fechado — o padrão dos apps financeiros premium.
// `rolling` ativa os dígitos de odômetro (usar no KPI do Dashboard).
// `gold` pinta o número (não o "R$") na cor de marca, com glow — usado nos
// momentos "hero" (patrimônio do Dashboard, preço em destaque do CardDetail).
export default function Money({ value, size = 32, rolling = false, gold = false, className = '' }) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
  const [intPart, cents] = formatted.split(',')

  const goldStyle = gold
    ? { color: '#F5A623', textShadow: '0 0 40px rgba(245,166,35,0.35)' }
    : {}

  if (!rolling) {
    return (
      <span
        className={`font-bold tabular-nums ${className}`}
        style={{ fontSize: size, letterSpacing: '-0.02em', lineHeight: 1, ...goldStyle }}
      >
        <span
          className="font-semibold text-[#8E8E93]"
          style={{ fontSize: Math.round(size * 0.55), marginRight: Math.round(size * 0.08) }}
        >
          R$
        </span>
        {intPart}
        <span style={{ fontSize: Math.round(size * 0.68) }}>,{cents}</span>
      </span>
    )
  }

  return (
    <span
      className={`font-bold tabular-nums ${className}`}
      style={{
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'flex-end',
        ...goldStyle,
      }}
    >
      <span
        className="font-semibold text-[#8E8E93]"
        style={{ fontSize: Math.round(size * 0.55), lineHeight: 1, marginRight: Math.round(size * 0.08) }}
      >
        R$
      </span>
      {intPart.split('').map((ch, i) =>
        /\d/.test(ch)
          // key inclui o comprimento: quando muda a qtde de dígitos (0 → 559),
          // as colunas remontam e rolam do zero até o alvo
          ? <DigitCol key={`i${intPart.length}-${i}`} digit={Number(ch)} />
          : <span key={`s${i}`} style={{ lineHeight: 1 }}>{ch}</span>
      )}
      <span
        style={{
          fontSize: Math.round(size * 0.68),
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'flex-end',
        }}
      >
        ,{cents.split('').map((ch, i) => <DigitCol key={`c${i}`} digit={Number(ch)} />)}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo de lint

- [ ] **Step 3: Commit**

```bash
git add src/components/Money.jsx
git commit -m "$(cat <<'EOF'
feat: Money.jsx ganha prop gold para numeros hero

color+text-shadow herdados cobrem tanto o modo estatico quanto o
odometro (rolling), sem a armadilha de background-clip:text nao se
propagar para spans filhos com texto proprio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `src/components/CardTile.jsx` — glow por tipo + sheen

**Files:**
- Modify: `src/components/CardTile.jsx`

**Interfaces:**
- Consumes: `getTypeGlow(type)` de `src/utils/typeColors.js` (Task 2), classe `.holo-sheen` de `src/index.css` (Task 4)

Nota de implementação: o glow (`box-shadow`) vai num `<div>` **sem** `overflow-hidden`, e a imagem/sheen ficam num `<div>` filho **com** `overflow-hidden` — `overflow:hidden` + `border-radius` no mesmo elemento que tem `box-shadow` corta o próprio glow em vários browsers.

- [ ] **Step 1: Substituir o conteúdo completo de `src/components/CardTile.jsx`**

```jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { brl } from '../utils/format'
import { getTypeGlow } from '../utils/typeColors'

export default function CardTile({ card, owned, quantity, price, index = 0 }) {
  const navigate = useNavigate()
  const delay = Math.min(index * 28, 560)
  const glow = owned ? getTypeGlow(card.type) : null

  return (
    <button
      onClick={() => navigate(`/card/${card.id}`, { viewTransition: true })}
      className="pressable relative flex flex-col text-left card-enter"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`relative w-full aspect-[2.5/3.5] rounded-xl ${!owned ? 'border border-white/[0.06]' : ''}`}
        style={glow || undefined}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#101014]">
          <img
            src={card.images?.small || card.image_url}
            alt={card.name}
            className={`w-full h-full object-cover ${!owned ? 'silhouette' : ''}`}
            loading="lazy"
          />
          {owned && <div className="holo-sheen" />}
        </div>
        {owned && quantity > 1 && (
          <span className="absolute top-2 right-2 bg-[#F4F4F6] text-[#000000] text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
            {quantity}×
          </span>
        )}
      </div>

      <div className="pt-2 pb-1 px-0.5">
        <p className="text-[#F4F4F6] text-[12px] font-semibold leading-snug truncate">
          {card.name}
        </p>
        {owned && price != null && price > 0 ? (
          <p className="text-[#F5A623] text-[11px] font-bold tabular-nums mt-0.5">{brl(price)}</p>
        ) : (
          <p className="text-[#8E8E93] text-[10px] tabular-nums mt-0.5">
            #{String(card.number || '').padStart(3, '0')}
          </p>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo

- [ ] **Step 3: Commit**

```bash
git add src/components/CardTile.jsx
git commit -m "$(cat <<'EOF'
feat: CardTile ganha glow por tipo e sheen holografico

Cartas possuidas: box-shadow colorido pelo tipo Pokemon (fallback
dourado) num wrapper sem overflow-hidden, e sheen animado dentro do
wrapper interno que recorta a imagem. Preco deixa de ser verde
(nao sinaliza variacao, e so o valor de mercado) e vira dourado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `src/components/PriceChart.jsx` — linha dourada, eixo, tooltip por toque

**Files:**
- Modify: `src/components/PriceChart.jsx`

**Interfaces:**
- Consumes: mesma prop `history: Array<{price_brl, date_recorded}>` de antes — nenhuma mudança de interface com `CardDetail.jsx`, só o conteúdo interno

- [ ] **Step 1: Substituir o conteúdo completo de `src/components/PriceChart.jsx`**

```jsx
import React, { useState } from 'react'
import { formatDate, brl } from '../utils/format'

const GOLD = '#F5A623'

export default function PriceChart({ history }) {
  const [activeIdx, setActiveIdx] = useState(null)

  if (!history || history.length < 2) {
    return (
      <p className="text-[#8E8E93] text-sm text-center py-6">
        Histórico insuficiente para exibir gráfico
      </p>
    )
  }

  const prices = history.map(h => h.price_brl)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const W = 300, H = 72, P = 3
  const pts = history.map((h, i) => {
    const x = P + (i / (history.length - 1)) * (W - P * 2)
    const y = H - P - ((h.price_brl - min) / range) * (H - P * 2)
    return { x, y }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const lastPt = pts[pts.length - 1]

  function pointerToIndex(clientX, svgEl) {
    const rect = svgEl.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * W
    let closest = 0
    let closestDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - relX)
      if (d < closestDist) { closestDist = d; closest = i }
    })
    return closest
  }

  function handleMove(e) {
    setActiveIdx(pointerToIndex(e.clientX, e.currentTarget))
  }

  const activePt = activeIdx != null ? pts[activeIdx] : null
  const activeEntry = activeIdx != null ? history[activeIdx] : null

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-[#8E8E93] mb-1">
        <span>Mín. {brl(min)}</span>
        <span>Máx. {brl(max)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setActiveIdx(null)}
        onPointerUp={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${P},${H - P} ${polyline} ${W - P},${H - P}`}
          fill="url(#chart-fill)"
          className="spark-fill"
        />
        <polyline
          points={polyline}
          pathLength="1"
          className="spark-draw"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={GOLD} className="spark-fill" />
        {activePt && (
          <g>
            <line x1={activePt.x} y1={0} x2={activePt.x} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <circle cx={activePt.x} cy={activePt.y} r="4" fill="#000000" stroke={GOLD} strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-[#8E8E93]">
          {formatDate((activeEntry || history[history.length - 1]).date_recorded)}
        </span>
        <span className="text-[#F5A623]" style={{ fontWeight: 600 }}>
          {brl((activeEntry || history[history.length - 1]).price_brl)}
        </span>
      </div>
    </div>
  )
}
```

Nota de design: em vez de uma caixa de tooltip flutuante (posicionamento/overflow arriscados numa tela estreita), a linha de data+preço abaixo do gráfico funciona como o "tooltip" — atualiza em tempo real enquanto o dedo arrasta sobre a linha, com um marcador vertical + ponto no gráfico indicando a posição exata. Cumpre o requisito do spec ("tooltip ao tocar/arrastar mostrando data + preço exato") com uma implementação mais robusta em mobile.

- [ ] **Step 2: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo

- [ ] **Step 3: Commit**

```bash
git add src/components/PriceChart.jsx
git commit -m "$(cat <<'EOF'
feat: PriceChart ganha eixo min/max e tooltip por toque/arraste

Linha e preenchimento sempre dourados (identidade do app) em vez de
verde/vermelho — a variacao continua sinalizada so pelo badge acima
do grafico, nunca pela cor da linha. Arrastar o dedo sobre o SVG
atualiza a linha de data+preco abaixo com o ponto exato tocado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `src/components/BottomNav.jsx` — botão central dourado

**Files:**
- Modify: `src/components/BottomNav.jsx:83-89`

- [ ] **Step 1: Trocar o estilo do botão central ativo**

Trocar:
```jsx
              <div className={`w-16 h-16 flex items-center justify-center rounded-full border-2 shadow-lg ${
                active
                  ? 'bg-[#F4F4F6] border-[#F4F4F6] text-[#000000]'
                  : 'bg-[#101014] border-white/[0.06] text-[#8E8E93]'
              }`}>
                <Icon heavy={active} />
              </div>
```
Por:
```jsx
              <div
                className={`w-16 h-16 flex items-center justify-center rounded-full border-2 shadow-lg ${
                  active ? 'border-transparent text-black' : 'bg-[#101014] border-white/[0.06] text-[#8E8E93]'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg, #F5A623, #E8871E)',
                  boxShadow: '0 8px 20px rgba(245,166,35,0.35)',
                } : undefined}
              >
                <Icon heavy={active} />
              </div>
```

- [ ] **Step 2: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.jsx
git commit -m "$(cat <<'EOF'
feat: botao central do BottomNav vira gradiente dourado quando ativo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `src/pages/Dashboard.jsx` — hero sem caixa + tiles com glow

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `getTypeGlow(type)` de `src/utils/typeColors.js` (Task 2), prop `gold` de `<Money>` (Task 5), classe `.holo-sheen` (Task 4)

- [ ] **Step 1: Adicionar o import de `getTypeGlow`**

Trocar:
```js
import PokeballLoader from '../components/PokeballLoader'
import OfflineBanner from '../components/OfflineBanner'
import Money from '../components/Money'
```
Por:
```js
import PokeballLoader from '../components/PokeballLoader'
import OfflineBanner from '../components/OfflineBanner'
import Money from '../components/Money'
import { getTypeGlow } from '../utils/typeColors'
```

- [ ] **Step 2: Substituir o bloco de KPI (patrimônio) por um hero sem caixa**

Trocar:
```jsx
        {/* ── KPI Block ──────────────────────────────────────────────────────── */}
        <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5">
          <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-3">
            Valor Total da Coleção
          </p>
          <p className="text-[#F4F4F6] leading-none mb-3">
            <Money value={totalValue} size={48} rolling />
          </p>

          {invested > 0 && (
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                pnl >= 0 ? 'bg-[#00E67614] text-[#00E676]' : 'bg-[#FF3B3014] text-[#FF3B30]'
              }`}>
                {pnl >= 0 ? '↑' : '↓'} {pnl >= 0 ? '+' : ''}{brl(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
              </span>
              <span className="text-[#8E8E93] text-[11px]">investido {brl(invested)}</span>
            </div>
          )}

          <InlineSparkline data={sparkData} />

          {lastUpdate && (
            <p className="text-[#8E8E93] text-[11px] mt-3">
              Atualizado{' '}
              {new Date(lastUpdate).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>
```
Por:
```jsx
        {/* ── Hero de patrimônio — sem caixa, luz própria ──────────────────────── */}
        <div className="relative text-center py-4 overflow-hidden">
          <div
            className="absolute pointer-events-none"
            style={{
              top: -40, left: '50%', transform: 'translateX(-50%)',
              width: 280, height: 200,
              background: 'radial-gradient(ellipse at 50% 30%, rgba(245,166,35,0.35), transparent 65%)',
              filter: 'blur(30px)',
            }}
          />
          <p className="relative text-[#8E8E93] text-[11px] font-medium uppercase tracking-widest mb-2">
            Valor Total da Coleção
          </p>
          <p className="relative leading-none flex justify-center">
            <Money value={totalValue} size={52} rolling gold />
          </p>

          {invested > 0 && (
            <div className="relative flex items-center justify-center gap-2.5 mt-4 mb-1 flex-wrap">
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                pnl >= 0 ? 'bg-[#00E67614] text-[#00E676]' : 'bg-[#FF3B3014] text-[#FF3B30]'
              }`}>
                {pnl >= 0 ? '↑' : '↓'} {pnl >= 0 ? '+' : ''}{brl(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
              </span>
              <span className="text-[#8E8E93] text-[11px]">investido {brl(invested)}</span>
            </div>
          )}

          <div className="relative mt-5">
            <InlineSparkline data={sparkData} />
          </div>

          {lastUpdate && (
            <p className="relative text-[#8E8E93] text-[11px] mt-3">
              Atualizado{' '}
              {new Date(lastUpdate).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>
```

- [ ] **Step 3: Remover borda pesada dos chips Cartas/Progresso e trocar "Progresso" para dourado**

Trocar:
```jsx
        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#101014] border border-white/[0.06] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Cartas</p>
            <p className="text-[#F4F4F6] text-[22px] font-bold tabular-nums leading-none">{uniqueOwned}</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">de {totalCards}</p>
          </div>
          <div className="flex-1 bg-[#101014] border border-white/[0.06] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Progresso</p>
            <p className="text-[#00E676] text-[22px] font-bold tabular-nums leading-none">{progress.toFixed(1)}%</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">da coleção</p>
          </div>
        </div>
```
Por:
```jsx
        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#101014] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Cartas</p>
            <p className="text-[#F4F4F6] text-[22px] font-bold tabular-nums leading-none">{uniqueOwned}</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">de {totalCards}</p>
          </div>
          <div className="flex-1 bg-[#101014] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Progresso</p>
            <p className="text-[#F5A623] text-[22px] font-bold tabular-nums leading-none">{progress.toFixed(1)}%</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">da coleção</p>
          </div>
        </div>
```

- [ ] **Step 4: Aplicar glow por tipo + sheen nos tiles do carrossel "Mais Valiosas"**

Trocar:
```jsx
                {top3.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/card/${item.card_id}`, { viewTransition: true })}
                    className="pressable flex-shrink-0 w-36 bg-[#101014] border border-white/[0.06] rounded-2xl overflow-hidden active:bg-[#1A1A20]"
                  >
                    <div className="w-full" style={{ aspectRatio: '2.5/3.5' }}>
                      {item.cards?.image_url && (
                        <img
                          src={item.cards.image_url}
                          alt={item.cards?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-3 text-left">
                      <p className="text-[#F4F4F6] text-[12px] font-semibold truncate leading-snug">
                        {item.cards?.name}
                      </p>
                      <p className="text-[#00E676] text-[13px] font-bold tabular-nums mt-0.5">
                        {brl(item.price)}
                      </p>
                    </div>
                  </button>
                ))}
```
Por:
```jsx
                {top3.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/card/${item.card_id}`, { viewTransition: true })}
                    className="pressable flex-shrink-0 w-36 rounded-2xl active:opacity-90"
                    style={getTypeGlow(item.cards?.type)}
                  >
                    <div className="relative w-full rounded-2xl overflow-hidden bg-[#101014]" style={{ aspectRatio: '2.5/3.5' }}>
                      {item.cards?.image_url && (
                        <img
                          src={item.cards.image_url}
                          alt={item.cards?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="holo-sheen" />
                    </div>
                    <div className="p-3 text-left">
                      <p className="text-[#F4F4F6] text-[12px] font-semibold truncate leading-snug">
                        {item.cards?.name}
                      </p>
                      <p className="text-[#F5A623] text-[13px] font-bold tabular-nums mt-0.5">
                        {brl(item.price)}
                      </p>
                    </div>
                  </button>
                ))}
```

- [ ] **Step 5: Dourar a barra de progresso de atualização de preços**

Trocar:
```jsx
            <div className="bg-white/[0.08] rounded-full h-[2px]">
              <div
                className="bg-[#00E676] h-[2px] rounded-full transition-all duration-500"
                style={{
                  width: `${updateProgress.total
                    ? (updateProgress.current / updateProgress.total) * 100
                    : 0}%`
                }}
              />
            </div>
```
Por:
```jsx
            <div className="bg-white/[0.08] rounded-full h-[2px]">
              <div
                className="bg-[#F5A623] h-[2px] rounded-full transition-all duration-500"
                style={{
                  width: `${updateProgress.total
                    ? (updateProgress.current / updateProgress.total) * 100
                    : 0}%`
                }}
              />
            </div>
```

- [ ] **Step 6: Dourar a sparkline (`SparkSVG`)**

Trocar:
```jsx
function SparkSVG({ pts, W, H }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00E676" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" className="spark-fill" />
      <polyline
        points={pts}
        pathLength="1"
        className="spark-draw"
        fill="none"
        stroke="#00E676"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```
Por:
```jsx
function SparkSVG({ pts, W, H }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" className="spark-fill" />
      <polyline
        points={pts}
        pathLength="1"
        className="spark-draw"
        fill="none"
        stroke="#F5A623"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

- [ ] **Step 7: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo

- [ ] **Step 8: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "$(cat <<'EOF'
feat: redesign do Dashboard — hero de patrimonio sem caixa

Valor total ganha glow spotlight + Money gold, chips perdem borda
pesada, "Progresso" e a sparkline migram de verde (decorativo) para
dourado, e os tiles do carrossel "Mais Valiosas" ganham glow por
tipo + sheen holografico, alinhados aos CardTiles da Colecao.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `src/pages/Pokedex.jsx` — bloco de progresso sem caixa

**Files:**
- Modify: `src/pages/Pokedex.jsx:141-153`

- [ ] **Step 1: Substituir o bloco de progresso**

Trocar:
```jsx
        {/* Progress block */}
        <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#F4F4F6] font-bold text-4xl tabular-nums">{owned}</span>
            <span className="text-[#8E8E93] font-semibold text-2xl">/ {cardsInSet.length || TOTAL}</span>
          </div>
          <p className="text-[#00E676] text-sm font-semibold mb-4">{progress.toFixed(0)}% completo</p>
          <div className="bg-white/[0.08] rounded-full h-[3px]">
            <div
              className="progress-bar h-[3px] rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
```
Por:
```jsx
        {/* Progress block — sem caixa, hierarquia grande→pequeno */}
        <div className="px-1 py-2">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#F4F4F6] font-bold text-5xl tabular-nums tracking-tight">{owned}</span>
            <span className="text-[#8E8E93] font-semibold text-2xl">/ {cardsInSet.length || TOTAL}</span>
          </div>
          <p className="text-[#F5A623] text-sm font-semibold mb-4">{progress.toFixed(0)}% completo</p>
          <div className="bg-white/[0.08] rounded-full h-[3px]">
            <div
              className="progress-bar h-[3px] rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
```

- [ ] **Step 2: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo

- [ ] **Step 3: Commit**

```bash
git add src/pages/Pokedex.jsx
git commit -m "$(cat <<'EOF'
feat: bloco de progresso da Colecao perde caixa e vira dourado

"% completo" migra de verde (decorativo, nao e sinal de preco) para
dourado, consistente com o resto do redesign.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `src/pages/CardDetail.jsx` — palco de revelação

**Files:**
- Modify: `src/pages/CardDetail.jsx`

**Interfaces:**
- Consumes: prop `gold` de `<Money>` (Task 5)
- Produces: sub-componente `MetaBadge` local, usado só neste arquivo

Nota de escopo: o botão "..." do header antigo não tinha `onClick` (confirmado no código atual — é um botão morto, sem handler). Este task remove o header sticky inteiro (título "Detalhes da Carta" + botão morto) e substitui por um botão de voltar flutuante sobre o palco, conforme validado nos mockups — não há regressão funcional.

- [ ] **Step 1: Substituir o header sticky + hero da carta pelo palco de revelação**

Trocar (do início do `<div className="min-h-full ...">` até o fechamento do bloco de hero, linhas 136-203 do arquivo original):
```jsx
  return (
    <div className="min-h-full bg-[#000000] pb-32">

      {/* ── Header sticky com blur ao rolar ────────────────────────────────── */}
      <div
        className="safe-top sticky top-0 z-40 flex items-center justify-between px-5 pt-3 pb-2"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="pressable w-11 h-11 flex items-center justify-center bg-[#101014] border border-white/[0.06] rounded-xl text-[#F4F4F6]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
        <h1 className="text-[#F4F4F6] text-sm font-semibold">Detalhes da Carta</h1>
        <button
          className="pressable w-11 h-11 flex items-center justify-center bg-[#101014] border border-white/[0.06] rounded-xl text-[#8E8E93]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </div>

      {/* ── Card image — 46vh, glow ambiente + tilt 3D ─────────────────────── */}
      <div
        className="relative flex justify-center items-center overflow-hidden"
        style={{ height: '46vh', paddingLeft: 28, paddingRight: 28 }}
      >
        {/* Glow ambiente: a própria carta desfocada "ilumina" a tela */}
        <img
          src={card.image_url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ filter: 'blur(60px) saturate(1.5)', opacity: 0.35, transform: 'scale(1.15)' }}
        />
        <img
          src={card.image_url}
          alt={card.name}
          className="relative h-full w-auto object-contain rounded-xl"
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
          onPointerUp={resetTilt}
          onPointerCancel={resetTilt}
          style={{
            maxWidth: '72vw',
            zIndex: 1,
            // pan-y: tilt no toque sem bloquear o scroll vertical da página
            touchAction: 'pan-y',
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.18s ease-out',
            filter: isUltra
              ? 'drop-shadow(0 0 20px rgba(234,179,8,0.22)) drop-shadow(0 20px 56px rgba(0,0,0,0.9))'
              : 'drop-shadow(0 20px 56px rgba(0,0,0,0.9))',
          }}
        />
      </div>
```
Por:
```jsx
  return (
    <div className="min-h-full bg-[#000000] pb-32">

      {/* ── Palco de revelação: a carta respira sozinha, luz direcional de cima ──
          Sem header/barra fixa aqui — só o botão de voltar flutuante, como nos
          mockups validados. Dados (preço, gráfico, ficha) ficam abaixo, ao rolar. */}
      <div
        className="safe-top relative flex flex-col items-center justify-end overflow-hidden"
        style={{ height: '58vh', paddingBottom: 28 }}
      >
        {/* Spotlight: luz direcional vinda de cima, não glow difuso uniforme */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -140, left: '50%', transform: 'translateX(-50%)',
            width: 520, height: 420,
            background: 'conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(245,166,35,0.22) 35deg, rgba(245,166,35,0.5) 90deg, rgba(245,166,35,0.22) 145deg, transparent 180deg)',
            filter: 'blur(50px)',
            opacity: 0.9,
          }}
        />
        {/* Glow no "chão", sob a carta */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 90, left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 56,
            background: 'radial-gradient(ellipse, rgba(245,166,35,0.4), transparent 70%)',
            filter: 'blur(18px)',
          }}
        />

        <button
          onClick={() => navigate(-1)}
          className="pressable absolute top-4 left-4 z-10 flex items-center justify-center rounded-full text-[#F4F4F6]"
          style={{
            width: 44, height: 44,
            background: 'rgba(20,20,20,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>

        <img
          src={card.image_url}
          alt={card.name}
          className="relative z-[2] h-full w-auto object-contain rounded-xl"
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
          onPointerUp={resetTilt}
          onPointerCancel={resetTilt}
          style={{
            maxWidth: '68vw',
            // pan-y: tilt no toque sem bloquear o scroll vertical da página
            touchAction: 'pan-y',
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.18s ease-out',
            filter: isUltra
              ? 'drop-shadow(0 0 24px rgba(245,166,35,0.35)) drop-shadow(0 45px 80px rgba(0,0,0,0.95))'
              : 'drop-shadow(0 0 60px rgba(245,166,35,0.18)) drop-shadow(0 45px 80px rgba(0,0,0,0.95))',
          }}
        />

        {/* Identidade — nome grande e confiante, sem caixa */}
        <div className="relative z-[2] text-center mt-6 px-8">
          <p className="text-[#F5A623] text-[11px] font-bold uppercase tracking-widest opacity-85">
            {(card.set_name || card.set_code || '')}{card.rarity ? ` · ${rarityLabel[card.rarity] || card.rarity}` : ''}
          </p>
          <h2 className="text-[#F4F4F6] text-[26px] font-extrabold tracking-tight mt-1">{card.name}</h2>
          {latestPrice > 0 && (
            <p className="text-[#8E8E93] text-sm mt-2">
              Vale hoje <span className="text-[#F4F4F6] font-semibold">{brl(latestPrice)}</span>
              {diff && (
                <span className={diff.positive ? 'text-[#00E676]' : 'text-[#FF3B30]'}>
                  {' '}· {diff.positive ? '↑' : '↓'} {diff.label}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Indício de scroll */}
        <div className="relative z-[2] flex flex-col items-center gap-1 mt-5 opacity-50">
          <span className="text-[#8E8E93] text-[9px] uppercase tracking-widest">Ver detalhes</span>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-3.5 h-3.5" style={{ animation: 'bob 1.6s ease-in-out infinite' }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
```

- [ ] **Step 2: Trocar o bloco de preço por uma versão sem caixa**

Trocar:
```jsx
            {/* Price */}
            <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5">
              <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">
                Preço Atual (BRL)
              </p>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[#F4F4F6] leading-none">
                  {latestPrice > 0
                    ? <Money value={latestPrice} size={30} />
                    : <span className="text-3xl font-bold">—</span>}
                </p>
                {diff && (
                  <span className={`badge-pulse flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0 ${
                    diff.positive
                      ? 'bg-[#00E67614] text-[#00E676]'
                      : 'bg-[#FF3B3014] text-[#FF3B30]'
                  }`}>
                    {diff.positive ? '↑' : '↓'} {diff.label}
                  </span>
                )}
              </div>
            </div>
```
Por:
```jsx
            {/* Price — solto, sem caixa, mesmo tratamento de luz do hero */}
            <div className="text-center py-2">
              <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">
                Preço Atual (BRL)
              </p>
              <div className="flex items-center justify-center">
                {latestPrice > 0
                  ? <Money value={latestPrice} size={36} gold />
                  : <span className="text-3xl font-bold text-[#F4F4F6]">—</span>}
              </div>
              {diff && (
                <span className={`badge-pulse inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full mt-3 ${
                  diff.positive
                    ? 'bg-[#00E67614] text-[#00E676]'
                    : 'bg-[#FF3B3014] text-[#FF3B30]'
                }`}>
                  {diff.positive ? '↑' : '↓'} {diff.label}
                </span>
              )}
            </div>
```

- [ ] **Step 3: Trocar a lista de detalhes por badges em grid**

Trocar:
```jsx
            {/* Details list */}
            <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
              <DetailRow label="Coleção"   value={card.set_name || card.set_code || '—'} />
              <DetailRow label="Número"    value={card.number ? `#${card.number}` : '—'} />
              <DetailRow label="Ilustrador" value={card.illustrator || '—'} />
              {colItem
                ? <>
                    <DetailRow label="Estado"    value="Near Mint (NM)" />
                    <DetailRow label="Adicionado" value={formatDate(colItem.date_added)} last />
                  </>
                : <DetailRow label="Lançamento" value={card.release_date ? formatDate(card.release_date) : '—'} last />
              }
            </div>
```
Por:
```jsx
            {/* Metadados — badges em grid, não lista de linhas */}
            <div className="grid grid-cols-2 gap-2.5">
              <MetaBadge label="Coleção" value={card.set_name || card.set_code || '—'} />
              <MetaBadge label="Número" value={card.number ? `#${card.number}` : '—'} />
              {card.rarity && (
                <MetaBadge label="Raridade" value={rarityLabel[card.rarity] || card.rarity} gold={isUltra} />
              )}
              <MetaBadge
                label={colItem ? 'Estado' : 'Lançamento'}
                value={colItem ? 'Near Mint (NM)' : (card.release_date ? formatDate(card.release_date) : '—')}
              />
            </div>

            <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
              <DetailRow label="Ilustrador" value={card.illustrator || '—'} last={!colItem} />
              {colItem && <DetailRow label="Adicionado" value={formatDate(colItem.date_added)} last />}
            </div>
```

- [ ] **Step 4: Trocar o CTA "Adicionar à Coleção" para gradiente dourado**

Trocar:
```jsx
                <button
                  onClick={handleManualAdd}
                  disabled={busy}
                  className="pressable w-full h-14 flex items-center justify-center bg-[#F4F4F6] text-[#000000] font-semibold text-sm rounded-xl disabled:opacity-50"
                >
                  {busy ? 'Adicionando...' : 'Adicionar à Coleção'}
                </button>
```
Por:
```jsx
                <button
                  onClick={handleManualAdd}
                  disabled={busy}
                  className="pressable w-full h-14 flex items-center justify-center font-semibold text-sm rounded-xl disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, #F5A623, #E8871E)',
                    color: '#1a0f00',
                    boxShadow: '0 12px 30px rgba(245,166,35,0.3)',
                  }}
                >
                  {busy ? 'Adicionando...' : 'Adicionar à Coleção'}
                </button>
```

- [ ] **Step 5: Adicionar o sub-componente `MetaBadge` perto de `DetailRow`**

Trocar:
```jsx
function DetailRow({ label, value, last }) {
  return (
    <div
      className={`flex items-center justify-between px-5 ${last ? '' : 'border-b border-white/[0.06]'}`}
      style={{ minHeight: 64 }}
    >
      <p className="text-[#8E8E93] text-sm">{label}</p>
      <p className="text-[#F4F4F6] text-sm font-medium text-right max-w-[55%] truncate">{value}</p>
    </div>
  )
}
```
Por:
```jsx
function DetailRow({ label, value, last }) {
  return (
    <div
      className={`flex items-center justify-between px-5 ${last ? '' : 'border-b border-white/[0.06]'}`}
      style={{ minHeight: 64 }}
    >
      <p className="text-[#8E8E93] text-sm">{label}</p>
      <p className="text-[#F4F4F6] text-sm font-medium text-right max-w-[55%] truncate">{value}</p>
    </div>
  )
}

function MetaBadge({ label, value, gold }) {
  return (
    <div className="bg-[#101014] border border-white/[0.06] rounded-xl px-4 py-3">
      <p className="text-[#8E8E93] text-[9px] font-medium uppercase tracking-widest">{label}</p>
      <p className={`text-[13px] font-bold mt-1 truncate ${gold ? 'text-[#F5A623]' : 'text-[#F4F4F6]'}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 6: Build e lint**

Run: `npm run build 2>&1 | grep -E "built in|error"; npm run lint 2>&1 | tail -5`
Expected: `✓ built in <tempo>`, sem erro novo (confirma que `navigate`, `rarityLabel`, `formatDate`, `brl`, `card`, `tilt`, `handleTilt`, `resetTilt`, `isUltra`, `latestPrice`, `diff`, `colItem` continuam todos referenciados corretamente — nenhum ficou órfão nem foi removido por engano)

- [ ] **Step 7: Commit**

```bash
git add src/pages/CardDetail.jsx
git commit -m "$(cat <<'EOF'
feat: CardDetail vira palco de revelacao

Header sticky (com botao "..." morto, sem handler) da lugar a um
palco: spotlight direcional, sheen na carta, nome grande sem caixa,
indicio de scroll. Bloco de preco perde a caixa e ganha Money gold.
Lista DetailRow vira grid de badges (Colecao/Numero/Raridade/Estado),
CTA principal vira gradiente dourado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Verificação visual end-to-end

**Files:** nenhum (só verificação)

- [ ] **Step 1: Subir o preview e limpar cache**

Usar `preview_start` (reusar se já rodando), depois `preview_eval`: `localStorage.removeItem('pokedex-data-v1')` e recarregar.

- [ ] **Step 2: Dashboard**

`preview_resize` para `mobile`, navegar para `/`, `preview_screenshot`. Confirmar: número do patrimônio grande e dourado com glow atrás, sem caixa ao redor; chips Cartas/Progresso sem borda; "Progresso" em dourado; tiles do carrossel com brilho sutil na borda.

- [ ] **Step 3: Coleção**

Navegar para `/pokedex`, `preview_screenshot`. Confirmar: bloco de progresso sem caixa, "% completo" em dourado; `CardTile`s possuídos com glow de borda (dourado ou colorido por tipo, se o backfill da Task 3 já rodou) e sheen sutil; tiles não possuídos continuam em silhueta, sem glow.

- [ ] **Step 4: CardDetail**

Abrir uma carta possuída (`preview_click` num `CardTile`), `preview_screenshot`. Confirmar: sem header no topo, botão de voltar flutuante translúcido, carta com spotlight/glow dourado, nome grande abaixo, indício de scroll. Rolar a página (`preview_eval`: `window.scrollTo(0, 400)` ou similar) e tirar novo screenshot: bloco de preço sem caixa, badges de metadados em grid, gráfico de preço com linha dourada (se a carta tiver histórico ≥2 pontos), CTA/ações com gradiente dourado.

- [ ] **Step 5: Carta sem tipo mapeado / sem histórico**

Testar uma carta possuída cujo `type` ainda seja `null` (antes do backfill rodar para todos os sets, ou uma carta fora do mapa) → confirmar fallback dourado, sem erro no console (`preview_console_logs` com `level: error`). Testar uma carta com menos de 2 pontos de histórico de preço → confirmar que o `PriceChart` mostra a mensagem de histórico insuficiente, sem quebrar.

- [ ] **Step 6: Interação do gráfico de preço**

Numa carta com histórico ≥2 pontos, simular arraste sobre o SVG do gráfico (`preview_click` ou `preview_eval` disparando `pointermove`) e confirmar que a linha de data/preço abaixo do gráfico atualiza.

- [ ] **Step 7: Console limpo**

`preview_console_logs` com `level: error` em todas as telas visitadas — nenhum erro novo.

- [ ] **Step 8: Atualizar a memória do projeto**

Registrar em `/Users/caueveroneze/.claude/projects/-Users-caueveroneze-Pokedex/memory/project-pokedex.md` que o redesign visual premium ("palco de revelação") foi concluído: dourado como cor de marca, verde/vermelho exclusivos para P&L, glow por tipo Pokémon nos CardTiles, CardDetail reestruturado como palco de revelação.

---

## Self-Review

**Cobertura do spec:** tokens de cor (Task 4/5/6/7/8/9/10/11 aplicam a troca verde-decorativo→dourado em todos os pontos identificados via grep), CardDetail palco de revelação (Task 11), Dashboard hero sem caixa (Task 9), Coleção sem caixa (Task 10), BottomNav dourado (Task 8), migration + backfill de tipo (Tasks 1 e 3), glow por tipo nos CardTile (Tasks 2 e 6, reaplicado no carrossel do Dashboard na Task 9), gráfico de preço com eixo/tooltip (Task 7). Verificação end-to-end cobre os 3 fluxos principais + casos de borda (sem tipo, sem histórico). Nenhum ponto do spec ficou sem task correspondente.

**Placeholders:** nenhum encontrado — todo código nas tasks é completo e real (JSX/JS integral, não snippets parciais com "..." exceto nos diffs "trocar X por Y" onde X e Y são ambos completos).

**Consistência de tipos:** `getTypeGlow(type)` (Task 2) usado com a mesma assinatura em `CardTile.jsx` (Task 6) e `Dashboard.jsx` (Task 9). Prop `gold` de `<Money>` (Task 5) usada identicamente em `Dashboard.jsx` (Task 9, com `rolling`) e `CardDetail.jsx` (Task 11, sem `rolling`) — ambos os caminhos de `Money.jsx` tratam `gold` via `color`+`text-shadow` herdados, sem depender de `background-clip:text`. `MetaBadge` (Task 11) só é usado dentro do próprio `CardDetail.jsx`, sem dependência cruzada.

**Desvios documentados do spec:** (1) o gradiente de texto no número (`background-clip: text`) descrito no spec foi substituído por cor sólida dourada + `text-shadow` no `Money.jsx`, porque o modo `rolling` (dígitos em colunas separadas) quebra a técnica de gradiente clipado em elementos filhos — a alternativa preserva a sensação de "luz" sem o risco de dígitos invisíveis. (2) O "tooltip ao tocar" do `PriceChart` usa a linha de data/preço já existente abaixo do gráfico (atualizada dinamicamente) em vez de uma caixa flutuante posicionada sobre o SVG — mais robusto em telas estreitas, sem risco de overflow/corte. Ambos os desvios preservam a intenção do spec (número com "luz própria", gráfico interativo ao toque) com implementação mais simples e testável.
