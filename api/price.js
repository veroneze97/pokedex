export const maxDuration = 30

import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { getSetByCode } from './_sets.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) return

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

// Cotação USD→BRL com cache de 1h por instância; fallback se a API cair
let rateCache = { value: 5.75, fetchedAt: 0 }
const RATE_TTL = 60 * 60 * 1000

async function getUsdBrlRate() {
  if (Date.now() - rateCache.fetchedAt < RATE_TTL) return rateCache.value
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    if (res.ok) {
      const data = await res.json()
      const bid = parseFloat(data?.USDBRL?.bid)
      if (bid > 0) {
        rateCache = { value: bid, fetchedAt: Date.now() }
        return bid
      }
    }
  } catch (e) {
    console.warn('Cotação USD-BRL indisponível, usando último valor:', e.message)
  }
  return rateCache.value
}

async function fetchTcgPrice(cardName, setCode) {
  const setRow = await getSetByCode(supabase, setCode)
  const apiSetId = setRow?.pokemontcg_id || 'me2'

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
    return extractPrice(card2, await getUsdBrlRate())
  }

  return extractPrice(card, await getUsdBrlRate())
}

function extractPrice(card, brlRate) {
  const prices = card.tcgplayer?.prices
  if (!prices) return null

  const usdPrice =
    prices.holofoil?.market ||
    prices.normal?.market ||
    prices.reverseHolofoil?.market ||
    prices['1stEditionHolofoil']?.market ||
    prices['1stEditionNormal']?.market

  if (!usdPrice || usdPrice <= 0) return null

  const brlPrice = Math.round(usdPrice * brlRate * 100) / 100

  return { price: brlPrice, source: 'tcgapi_usd' }
}
