/**
 * Busca um set completo da TCGdex API (nomes/raridade/imagem em PT-BR) e
 * faz upsert em `sets` (1 linha) e `cards` (N linhas) no Supabase.
 * Idempotente — pode rodar de novo sem duplicar.
 *
 * Uso: node --experimental-websocket --env-file=.env scripts/seed-set.js <tcgdex_id> [locale]
 * Ex:  node --experimental-websocket --env-file=.env scripts/seed-set.js me02.5
 * Ex:  node --experimental-websocket --env-file=.env scripts/seed-set.js me04 en
 *
 * locale (opcional, default 'pt'): idioma buscado na TCGdex. Para locale != 'pt',
 * grava como uma coleção independente (id `${tcgdex_id}-${locale}`, nationality
 * em maiúsculas do locale), sem afetar a versão já gravada em outro idioma.
 *
 * Requer no ambiente: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const BATCH_SIZE = 8
const BATCH_DELAY_MS = 300

// Único dado que a API não expõe pronto para nossa tabela: o prefixo de ID
// de carta (convenção interna). Tudo mais (nome, total, data, raridade) vem
// direto da TCGdex — adicionar um set futuro só exige uma entrada aqui.
// Chave composta 'tcgdex_id:locale' para versões em idioma diferente de PT.
const ID_PREFIX_BY_SET = {
  'me02.5': 'me025',
  'me03':   'me03',
  'me04':   'me04',
  'me04:en': 'me04en',
  'me05:en': 'me05en',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`)
  return res.json()
}

async function fetchCardsInBatches(cardIds, tcgdexApi) {
  const details = []
  for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
    const batch = cardIds.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(id =>
        fetchJson(`${tcgdexApi}/cards/${id}`).catch(e => {
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

async function seed(tcgdexId, locale = 'pt') {
  const lookupKey = locale === 'pt' ? tcgdexId : `${tcgdexId}:${locale}`
  const idPrefix = ID_PREFIX_BY_SET[lookupKey]
  if (!idPrefix) {
    console.error(`Set "${lookupKey}" não está em ID_PREFIX_BY_SET. Adicione uma entrada antes de rodar.`)
    process.exit(1)
  }

  const setId = locale === 'pt' ? tcgdexId : `${tcgdexId}-${locale}`
  const nationality = locale === 'pt' ? 'PT-BR' : locale.toUpperCase()
  const tcgdexApi = `https://api.tcgdex.net/v2/${locale}`

  console.log(`Buscando set ${tcgdexId} (${locale}) na TCGdex...`)
  const setData = await fetchJson(`${tcgdexApi}/sets/${tcgdexId}`)
  console.log(`${setData.name} — ${setData.cards.length} cartas`)

  console.log('Buscando detalhes (raridade) de cada carta...')
  const details = await fetchCardsInBatches(setData.cards.map(c => c.id), tcgdexApi)

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

  const setRow = {
    id: setId,
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
const locale = process.argv[3] || 'pt'
if (!tcgdexId) {
  console.error('Uso: node --experimental-websocket --env-file=.env scripts/seed-set.js <tcgdex_id> [locale]')
  console.error('Sets disponíveis:', Object.keys(ID_PREFIX_BY_SET).join(', '))
  process.exit(1)
}

seed(tcgdexId, locale).catch(e => { console.error(e); process.exit(1) })
