import { createClient } from '@supabase/supabase-js'
import { checkAuth } from './_auth.js'
import { recordPortfolioSnapshot } from './_portfolio.js'
import { getSetByCode } from './_sets.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { method } = req

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('collection')
      .select('*, cards(*)')
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (method === 'POST')   return handlePost(req, res)
  if (method === 'PATCH')  return handlePatch(req, res)
  if (method === 'DELETE') return handleDelete(req, res)

  res.status(405).json({ error: 'Method not allowed' })
}

// ── POST: adicionar carta (via câmera ou manualmente por cardId) ────────────
async function handlePost(req, res) {
  if (!checkAuth(req, res)) return
  const { number, setCode, name, rarity, imageUrl, cardId, purchasePrice } = req.body

  let card = null

  if (cardId) {
    // Adição manual: a carta já existe no catálogo
    const { data } = await supabase.from('cards').select('*').eq('id', cardId).maybeSingle()
    if (!data) return res.status(404).json({ error: 'Carta não encontrada no catálogo' })
    card = data
  } else {
    // Fluxo da câmera: encontrar ou criar a carta
    const setRow = await getSetByCode(supabase, setCode)
    if (!setRow) return res.status(400).json({ error: `Set desconhecido: ${setCode}` })
    const idPrefix = setRow.id_prefix

    const { data: found } = await supabase
      .from('cards')
      .select('*')
      .eq('number', number)
      .eq('set_code', setCode)
      .maybeSingle()
    card = found

    if (!card) {
      const canonicalId = `${idPrefix}-${number}`
      const { data: byId } = await supabase
        .from('cards')
        .select('*')
        .eq('id', canonicalId)
        .maybeSingle()

      if (byId) {
        card = byId
        if (byId.set_code !== setCode) {
          await supabase.from('cards').update({ set_code: setCode }).eq('id', canonicalId)
        }
      } else {
        const { data: inserted, error: ie } = await supabase
          .from('cards')
          .insert({
            id: canonicalId,
            name,
            number,
            set_code: setCode,
            nationality: 'PT-BR',
            rarity: rarity || null,
            image_url: imageUrl || '',
          })
          .select()
          .single()
        if (ie) return res.status(500).json({ error: ie.message })
        card = inserted
      }
    } else {
      const updates = {}
      if (!card.image_url && imageUrl) updates.image_url = imageUrl
      if (!card.rarity && rarity) updates.rarity = rarity
      if (Object.keys(updates).length > 0) {
        await supabase.from('cards').update(updates).eq('id', card.id)
      }
    }
  }

  // Upsert na coleção
  const { data: existing } = await supabase
    .from('collection')
    .select('*')
    .eq('card_id', card.id)
    .maybeSingle()

  const price = normalizePrice(purchasePrice)

  if (existing) {
    const updates = { quantity: existing.quantity + 1 }
    if (price != null) updates.purchase_price = price
    const { error: ue } = await supabase.from('collection').update(updates).eq('id', existing.id)
    if (ue) return res.status(500).json({ error: ue.message })
  } else {
    const { error: ce } = await supabase.from('collection').insert({
      card_id: card.id,
      quantity: 1,
      condition: 'NM',
      purchase_price: price,
      date_added: new Date().toISOString(),
    })
    if (ce) return res.status(500).json({ error: ce.message })
  }

  // Snapshot do portfólio — falha não bloqueia o salvamento da carta
  try { await recordPortfolioSnapshot(supabase) } catch (e) { console.warn(e.message) }

  return res.json({ success: true, cardId: card.id })
}

// ── PATCH: editar quantidade / preço pago ───────────────────────────────────
async function handlePatch(req, res) {
  if (!checkAuth(req, res)) return
  const { cardId, quantity, purchasePrice } = req.body
  if (!cardId) return res.status(400).json({ error: 'cardId obrigatório' })

  const updates = {}
  if (quantity !== undefined) {
    const q = parseInt(quantity, 10)
    if (!Number.isFinite(q) || q < 1) return res.status(400).json({ error: 'Quantidade inválida' })
    updates.quantity = q
  }
  if (purchasePrice !== undefined) {
    // null explícito limpa o preço pago
    updates.purchase_price = purchasePrice === null ? null : normalizePrice(purchasePrice)
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nada para atualizar' })
  }

  const { data, error } = await supabase
    .from('collection')
    .update(updates)
    .eq('card_id', cardId)
    .select()
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Carta não está na coleção' })

  try { await recordPortfolioSnapshot(supabase) } catch (e) { console.warn(e.message) }
  return res.json({ success: true, item: data })
}

// ── DELETE: remover carta da coleção ────────────────────────────────────────
async function handleDelete(req, res) {
  if (!checkAuth(req, res)) return
  const { cardId } = req.body
  if (!cardId) return res.status(400).json({ error: 'cardId obrigatório' })

  const { error } = await supabase.from('collection').delete().eq('card_id', cardId)
  if (error) return res.status(500).json({ error: error.message })

  try { await recordPortfolioSnapshot(supabase) } catch (e) { console.warn(e.message) }
  return res.json({ success: true })
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}
