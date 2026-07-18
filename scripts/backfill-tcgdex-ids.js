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
    try {
      await backfillSet(set)
    } catch (e) {
      console.error(`  ✗ falha no set ${set.id}, seguindo pro próximo:`, e.message)
    }
  }
  console.log('\n✓ Backfill concluído.')
}

main().catch(e => { console.error(e); process.exit(1) })
