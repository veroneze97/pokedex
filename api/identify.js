import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { getActiveSets } from './_sets.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ~6MB de base64 ≈ 4.5MB de imagem — muito acima do que uma foto de carta precisa
const MAX_IMAGE_BASE64 = 6_000_000

function buildSetRules(sets) {
  if (sets.length === 0) return '  * se não conseguir determinar → "PFLpt"'
  const lines = sets.map(s => `  * total = ${s.total} → "${s.id}"  (${s.name})`)
  const fallback = sets.find(s => s.id === 'PFLpt') || sets[0]
  lines.push(`  * se não conseguir ler o total → "${fallback.id}"`)
  return lines.join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  if (!rateLimit(req, res, { limit: 10, windowMs: 60_000 })) return

  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'Imagem obrigatória' })
  if (typeof image !== 'string' || image.length > MAX_IMAGE_BASE64) {
    return res.status(413).json({ error: 'Imagem muito grande' })
  }

  try {
    const sets = await getActiveSets(supabase)
    const setRules = buildSetRules(sets)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `Analise esta carta Pokémon TCG (pode ser Pokémon, Treinador ou Energia) e extraia as informações em JSON.

Regras:
- name: nome completo da carta como aparece impressa (ex: "Genesect", "Charizard ex", "Mega Signal", "Tinkatink")
- number: número da carta no rodapé, formato "NNN/TTT" (ex: "008/094", "121/132", "096/132")
- setCode: determine pelo total impresso após a barra no número da carta:
${setRules}
- rarity: raridade em inglês (ex: "Common", "Uncommon", "Rare", "Double Rare", "Ultra Rare", "Illustration Rare")
- isValidPTBR: true se a carta estiver em português

Responda APENAS com JSON válido, sem markdown, sem explicações:
{"name":"...","number":"...","setCode":"...","rarity":"...","isValidPTBR":true}`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].text.trim()
    const data = JSON.parse(text)
    res.json(data)
  } catch (e) {
    console.error('Vision error:', e)
    res.status(500).json({ error: 'Falha ao identificar carta' })
  }
}
