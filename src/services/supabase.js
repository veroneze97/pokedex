import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(url, key, {
  global: { fetch: (...args) => fetch(...args) },
})

// ── Cards catalog ──────────────────────────────────────────────────────────
export async function getAllCards() {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_code', 'PFLpt')
    .order('number')
  if (error) throw error
  return data
}

// ── Collection ─────────────────────────────────────────────────────────────
export async function getCollection() {
  const { data, error } = await supabase
    .from('collection')
    .select('*, cards(*)')
  if (error) throw error
  return data
}

export async function upsertCard(cardId) {
  // Check if exists
  const { data: existing } = await supabase
    .from('collection')
    .select('*')
    .eq('card_id', cardId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('collection')
      .update({ quantity: existing.quantity + 1 })
      .eq('id', existing.id)
    if (error) throw error
    return { ...existing, quantity: existing.quantity + 1 }
  }

  const { data, error } = await supabase
    .from('collection')
    .insert({ card_id: cardId, quantity: 1, condition: 'NM', date_added: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Price history ──────────────────────────────────────────────────────────
export async function getPriceHistory(cardId) {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('card_id', cardId)
    .order('date_recorded')
  if (error) throw error
  return data
}

export async function savePrice(cardId, priceBrl, source) {
  const { error } = await supabase
    .from('price_history')
    .insert({ card_id: cardId, price_brl: priceBrl, source, date_recorded: new Date().toISOString() })
  if (error) throw error
}

export async function getLatestPrices() {
  const { data, error } = await supabase
    .from('price_history')
    .select('card_id, price_brl, source, date_recorded')
    .order('date_recorded', { ascending: false })
  if (error) throw error
  // Return only the latest price per card
  const map = {}
  for (const row of data) {
    if (!map[row.card_id]) map[row.card_id] = row
  }
  return map
}
