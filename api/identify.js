import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image } = req.body
  if (!image) return res.status(400).json({ error: 'Imagem obrigatória' })

  try {
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
              text: `Analise esta carta Pokémon TCG e extraia as seguintes informações em JSON:
- name: nome do Pokémon (ex: "Genesect", "Charizard ex")
- number: número da carta no formato "NNN/TTT" (ex: "008/094")
- setCode: código do set incluindo sufixo de idioma (ex: "PFLpt" para PT-BR, "PFL" para inglês)
- rarity: raridade em inglês como aparece na carta (ex: "Common", "Uncommon", "Rare", "Ultra Rare")
- isValidPTBR: true se o setCode terminar em "pt" (impressão PT-BR), false caso contrário

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
