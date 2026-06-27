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

    // Find card
    let { data: card } = await supabase
      .from('cards')
      .select('*')
      .eq('number', number)
      .eq('set_code', setCode)
      .maybeSingle()

    if (!card) {
      const { data: inserted, error: ie } = await supabase
        .from('cards')
        .upsert({
          id: `pfl-${number}`,
          name,
          number,
          set_code: setCode,
          nationality: 'PT-BR',
          rarity: rarity || null,
          image_url: imageUrl || '',
        }, { onConflict: 'id' })
        .select()
        .single()
      if (ie) return res.status(500).json({ error: ie.message })
      card = inserted
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
