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
