import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: cards, error: ce } = await supabase
    .from('cards')
    .select('*')
    .in('set_code', ['PFLpt', 'ME1pt'])
    .order('number')

  if (ce) return res.status(500).json({ error: ce.message })

  const { data: collection, error: cole } = await supabase
    .from('collection')
    .select('*, cards(*)')

  if (cole) return res.status(500).json({ error: cole.message })

  // Include any collection cards not already in the PFLpt cards list
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

  res.json({ cards, collection, prices: priceMap, portfolio: portfolio || [] })
}
