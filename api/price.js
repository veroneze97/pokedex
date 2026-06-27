export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cardName, setCode } = req.body
  if (!cardName) return res.status(400).json({ error: 'cardName obrigatório' })

  // Try Mercado Livre API (official, not scraping)
  try {
    const ml = await fetchMercadoLivre(cardName, setCode)
    if (ml) return res.json(ml)
  } catch (e) {
    console.warn('MercadoLivre failed:', e.message)
  }

  // Fallback: Pokémon TCG API market price (USD → BRL)
  try {
    const tcg = await fetchTcgPrice(cardName, setCode)
    if (tcg) return res.json(tcg)
  } catch (e) {
    console.warn('TCG API price failed:', e.message)
  }

  res.status(404).json({ error: 'Preço não encontrado' })
}

async function fetchMercadoLivre(cardName, setCode) {
  const query = encodeURIComponent(`carta pokemon ${cardName} ${setCode || ''} NM`)
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${query}&limit=10`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`ML API responded ${res.status}`)
  const data = await res.json()

  const results = (data.results || []).filter(r =>
    r.price > 1 &&
    r.price < 5000 &&
    (r.title?.toLowerCase().includes('pokemon') || r.title?.toLowerCase().includes('pokémon'))
  )

  if (!results.length) return null

  const prices = results.map(r => r.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]

  return { price: Math.round(median * 100) / 100, source: 'mercadolivre' }
}

async function fetchTcgPrice(cardName, setCode) {
  // setCode PFLpt → me2
  const setMap = { PFLpt: 'me2', pflpt: 'me2' }
  const apiSetId = setMap[setCode] || setCode?.toLowerCase()

  const q = encodeURIComponent(`name:"${cardName}" set.id:${apiSetId}`)
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=3`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`TCG API responded ${res.status}`)

  const data = await res.json()
  const card = data.data?.[0]
  if (!card) return null

  // Get market price (NM) and convert USD → BRL (taxa aproximada)
  const usdPrice =
    card.tcgplayer?.prices?.holofoil?.market ||
    card.tcgplayer?.prices?.normal?.market ||
    card.tcgplayer?.prices?.reverseHolofoil?.market ||
    card.tcgplayer?.prices?.['1stEditionNormal']?.market

  if (!usdPrice) return null

  const BRL_RATE = 5.7 // taxa aproximada USD/BRL
  const brlPrice = Math.round(usdPrice * BRL_RATE * 100) / 100

  return { price: brlPrice, source: 'tcgapi_usd' }
}
