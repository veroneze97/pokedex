import { createClient } from '@supabase/supabase-js'

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

  if (method === 'POST') {
    const { number, setCode, name, rarity, imageUrl } = req.body

    // Determine canonical ID prefix by setCode
    const idPrefix = setCode === 'ME1pt' ? 'me1' : 'pfl'

    // Find card
    let { data: card } = await supabase
      .from('cards')
      .select('*')
      .eq('number', number)
      .eq('set_code', setCode)
      .maybeSingle()

    if (!card) {
      // Try to find by canonical ID regardless of set_code (handles set_code mismatches)
      const canonicalId = `${idPrefix}-${number}`
      const { data: byId } = await supabase
        .from('cards')
        .select('*')
        .eq('id', canonicalId)
        .maybeSingle()

      if (byId) {
        card = byId
        // Update set_code to canonical if wrong, but keep existing name/image
        if (byId.set_code !== setCode) {
          await supabase.from('cards').update({ set_code: setCode }).eq('id', canonicalId)
        }
      } else {
        // Insert new card — only if imageUrl is non-empty, otherwise leave blank to preserve future updates
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
      // Card found — update only fields that were empty/missing, never overwrite good data with empty
      const updates = {}
      if (!card.image_url && imageUrl) updates.image_url = imageUrl
      if (!card.rarity && rarity) updates.rarity = rarity
      if (Object.keys(updates).length > 0) {
        await supabase.from('cards').update(updates).eq('id', card.id)
      }
    }

    // Upsert collection
    const { data: existing } = await supabase
      .from('collection')
      .select('*')
      .eq('card_id', card.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('collection')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('collection')
        .insert({ card_id: card.id, quantity: 1, condition: 'NM', date_added: new Date().toISOString() })
    }

    return res.json({ success: true, cardId: card.id })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
