import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { cardId, price, source } = req.body
  const { error } = await supabase
    .from('price_history')
    .insert({ card_id: cardId, price_brl: price, source, date_recorded: new Date().toISOString() })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
}
