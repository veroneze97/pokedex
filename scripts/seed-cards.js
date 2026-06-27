/**
 * Popula a tabela `cards` com as 94 cartas do set Fogo Fantasmagórico (PFLpt).
 * Usa a Pokémon TCG API para buscar dados e imagens.
 *
 * Uso: node scripts/seed-cards.js
 *
 * Requer no ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TCG_API_KEY (opcional)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TCG_API = 'https://api.pokemontcg.io/v2'
const headers = process.env.TCG_API_KEY ? { 'X-Api-Key': process.env.TCG_API_KEY } : {}

// set.id para o set inglês equivalente (Stellar Crown = sv7, mas Fogo Fantasmagórico = sv8pt5)
// Precisamos mapear o set PT-BR para o ID na TCG API
const SET_ID = 'sv8pt5' // Surging Sparks (equivalente ao Fogo Fantasmagórico)

async function fetchAllCards() {
  const res = await fetch(`${TCG_API}/cards?q=set.id:${SET_ID}&pageSize=250&orderBy=number`, { headers })
  const data = await res.json()
  return data.data || []
}

async function seed() {
  console.log(`Buscando cartas do set ${SET_ID}...`)
  const cards = await fetchAllCards()
  console.log(`${cards.length} cartas encontradas`)

  const rows = cards.map(c => ({
    id: `pfl-${c.number.padStart(3, '0')}`,
    name: c.name,
    number: c.number.padStart(3, '0'),
    set_code: 'PFLpt',
    nationality: 'PT-BR',
    rarity: c.rarity,
    image_url: c.images?.large || c.images?.small || '',
  }))

  const { error } = await supabase.from('cards').upsert(rows, { onConflict: 'number,set_code' })
  if (error) {
    console.error('Erro ao inserir cartas:', error)
    process.exit(1)
  }

  console.log(`✓ ${rows.length} cartas inseridas/atualizadas com sucesso!`)
}

seed()
