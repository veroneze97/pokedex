import { createClient } from '@supabase/supabase-js'
import { checkAuth } from './_auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  const { cardId, price, source } = req.body
  if (!cardId || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Dados inválidos' })
  }
  const { error } = await supabase
    .from('price_history')
    .insert({ card_id: cardId, price_brl: price, source, date_recorded: new Date().toISOString() })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
}
