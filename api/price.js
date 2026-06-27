export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cardName, setCode } = req.body
  if (!cardName) return res.status(400).json({ error: 'cardName obrigatório' })

  // Try Ligapokemon first
  try {
    const liga = await fetchLigapokemon(cardName)
    if (liga) return res.json(liga)
  } catch (e) {
    console.warn('Ligapokemon failed:', e.message)
  }

  // Fallback: Mercado Livre
  try {
    const ml = await fetchMercadoLivre(cardName, setCode)
    if (ml) return res.json(ml)
  } catch (e) {
    console.warn('MercadoLivre failed:', e.message)
  }

  res.status(404).json({ error: 'Preço não encontrado' })
}

async function fetchLigapokemon(cardName) {
  const query = encodeURIComponent(`${cardName} pokemon TCG`)
  const url = `https://www.ligapokemon.com.br/?view=cards/card&card=${query}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokeDexBot/1.0)' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`Liga responded ${res.status}`)
  const html = await res.text()

  // Extract price from Ligapokemon HTML (NM price)
  const match = html.match(/R\$\s*([\d.,]+)/)
  if (!match) return null

  const price = parseFloat(match[1].replace('.', '').replace(',', '.'))
  if (isNaN(price) || price <= 0) return null

  return { price, source: 'ligapokemon' }
}

async function fetchMercadoLivre(cardName, setCode) {
  const query = encodeURIComponent(`${cardName} pokemon carta ${setCode || 'ptbr'} NM`)
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${query}&limit=5&category=MLB1144`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })

  if (!res.ok) throw new Error(`ML API responded ${res.status}`)
  const data = await res.json()
  const results = data.results?.filter(r => r.condition === 'new' || r.title?.toLowerCase().includes('nm'))

  if (!results?.length) return null

  // Use median price
  const prices = results.map(r => r.price).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]

  return { price: median, source: 'mercadolivre' }
}
