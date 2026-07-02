import { createClient } from '@supabase/supabase-js'
import { checkAuth } from './_auth.js'
import { recordPortfolioSnapshot } from './_portfolio.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// POST /api/portfolio-snapshot — grava o snapshot do dia.
// Chamado pelo client após concluir uma atualização de preços em lote.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return

  const snapshot = await recordPortfolioSnapshot(supabase)
  res.json({ success: true, snapshot })
}
