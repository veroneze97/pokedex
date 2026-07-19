import { createClient } from '@supabase/supabase-js'
import { getActiveSets } from './_sets.js'
import { checkAuth } from './_auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return

  const sets = await getActiveSets(supabase)
  const setIds = sets.map(s => s.id)

  // O Supabase limita a 1000 linhas por resposta — com o catálogo passando
  // desse total, uma única query corta cartas em silêncio. Pagina até
  // esgotar (página menor que PAGE_SIZE = última página).
  const PAGE_SIZE = 1000
  const cards = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: ce } = await supabase
      .from('cards')
      .select('*')
      .in('set_code', setIds)
      .order('number')
      .range(from, from + PAGE_SIZE - 1)

    if (ce) return res.status(500).json({ error: ce.message })
    cards.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const { data: collection, error: cole } = await supabase
    .from('collection')
    .select('*, cards(id, name, number, rarity, set_code, image_url, type)')

  if (cole) return res.status(500).json({ error: cole.message })

  // Include any collection cards not already in the active sets list
  const cardIds = new Set(cards.map(c => c.id))
  for (const item of (collection || [])) {
    if (item.cards && !cardIds.has(item.cards.id)) {
      cards.push(item.cards)
      cardIds.add(item.cards.id)
    }
  }

  // Só cartas na coleção têm preço — evita varrer o histórico inteiro (cresce a cada atualização)
  const ownedCardIds = (collection || []).map(item => item.card_id)
  const { data: prices } = ownedCardIds.length > 0
    ? await supabase
        .from('price_history')
        .select('card_id, price_brl, source, date_recorded')
        .in('card_id', ownedCardIds)
        .order('date_recorded', { ascending: false })
    : { data: [] }

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
