export const maxDuration = 30

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cardName, setCode } = req.body
  if (!cardName) return res.status(400).json({ error: 'cardName obrigatório' })

  try {
    const result = await fetchTcgPrice(cardName, setCode)
    if (result) return res.json(result)
  } catch (e) {
    console.warn('TCG API price failed:', e.message)
  }

  res.status(404).json({ error: 'Preço não encontrado' })
}

async function fetchTcgPrice(cardName, setCode) {
  const setMap = { PFLpt: 'me2', pflpt: 'me2', ME2: 'me2' }
  const apiSetId = setMap[setCode] || setMap[setCode?.toLowerCase()] || 'me2'

  // Simplify name for search (remove accents and special chars)
  const simpleName = cardName
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .split(' ').slice(0, 3).join(' ') // max 3 words

  const q = `name:"${simpleName}" set.id:${apiSetId}`
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PokeDexPTBR/1.0' },
  })

  if (!res.ok) throw new Error(`TCG API responded ${res.status}`)

  const data = await res.json()
  const card = data.data?.[0]
  if (!card) {
    // Try broader search without set filter
    const res2 = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`name:"${simpleName}"`)}&pageSize=5`
    )
    const data2 = await res2.json()
    const card2 = data2.data?.find(c => c.set?.id === apiSetId) || data2.data?.[0]
    if (!card2) return null
    return extractPrice(card2)
  }

  return extractPrice(card)
}

function extractPrice(card) {
  const prices = card.tcgplayer?.prices
  if (!prices) return null

  const usdPrice =
    prices.holofoil?.market ||
    prices.normal?.market ||
    prices.reverseHolofoil?.market ||
    prices['1stEditionHolofoil']?.market ||
    prices['1stEditionNormal']?.market

  if (!usdPrice || usdPrice <= 0) return null

  const BRL_RATE = 5.75
  const brlPrice = Math.round(usdPrice * BRL_RATE * 100) / 100

  return { price: brlPrice, source: 'tcgapi_usd' }
}
