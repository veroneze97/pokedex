// Snapshot diário do valor do portfólio.
// Calcula o total (último preço de cada carta × quantidade) e grava/atualiza
// a linha do dia em portfolio_history (UNIQUE em snapshot_date → upsert).

export async function recordPortfolioSnapshot(supabase) {
  const { data: collection } = await supabase
    .from('collection')
    .select('card_id, quantity')
  if (!collection || collection.length === 0) return null

  const { data: prices } = await supabase
    .from('price_history')
    .select('card_id, price_brl, date_recorded')
    .order('date_recorded', { ascending: false })

  const latest = {}
  for (const p of prices || []) {
    if (latest[p.card_id] === undefined) latest[p.card_id] = p.price_brl
  }

  const total = collection.reduce(
    (sum, c) => sum + (latest[c.card_id] || 0) * c.quantity, 0
  )
  const count = collection.reduce((sum, c) => sum + c.quantity, 0)

  const snapshot = {
    snapshot_date: new Date().toISOString().slice(0, 10),
    total_brl: Math.round(total * 100) / 100,
    cards_count: count,
  }

  const { error } = await supabase
    .from('portfolio_history')
    .upsert(snapshot, { onConflict: 'snapshot_date' })

  if (error) {
    console.warn('Snapshot do portfólio falhou:', error.message)
    return null
  }
  return snapshot
}
