import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// GET /api/card-detail?id=me1-008
// Substitui o acesso direto do client ao Supabase (anon key removida do bundle).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id obrigatório' })

  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!card) return res.status(404).json({ error: 'Carta não encontrada' })

  const { data: colItem } = await supabase
    .from('collection')
    .select('*')
    .eq('card_id', id)
    .maybeSingle()

  let priceHistory = []
  if (colItem) {
    const { data: hist } = await supabase
      .from('price_history')
      .select('*')
      .eq('card_id', id)
      .order('date_recorded')
    priceHistory = hist || []
  }

  res.json({ card, colItem, priceHistory })
}
