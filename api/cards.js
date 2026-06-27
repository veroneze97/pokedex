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
    .eq('set_code', 'PFLpt')
    .order('number')

  if (ce) return res.status(500).json({ error: ce.message })

  const { data: collection, error: cole } = await supabase
    .from('collection')
    .select('*, cards(*)')

  if (cole) return res.status(500).json({ error: cole.message })

  const { data: prices } = await supabase
    .from('price_history')
    .select('card_id, price_brl, source, date_recorded')
    .order('date_recorded', { ascending: false })

  const priceMap = {}
  for (const p of prices || []) {
    if (!priceMap[p.card_id]) priceMap[p.card_id] = p
  }

  res.json({ cards, collection, prices: priceMap })
}
