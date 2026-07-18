// api/price.js
export const maxDuration = 30

import { createClient } from '@supabase/supabase-js'
import { checkAuth, rateLimit } from './_auth.js'
import { pickTcgplayerPrice } from './_tcgdexPricing.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req, res)) return
  if (!rateLimit(req, res, { limit: 60, windowMs: 60_000 })) return

  const { number, setCode } = req.body
  if (!number || !setCode) return res.status(400).json({ error: 'number e setCode obrigatórios' })

  try {
    const result = await fetchTcgdexPrice(number, setCode)
    if (result) return res.json(result)
  } catch (e) {
    console.warn('TCGdex price failed:', e.message)
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

async function fetchTcgdexPrice(number, setCode) {
  const { data: card, error } = await supabase
    .from('cards')
    .select('tcgdex_card_id')
    .eq('number', number)
    .eq('set_code', setCode)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!card?.tcgdex_card_id) return null

  const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.tcgdex_card_id}`)
  if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`)
  const tcgdexCard = await res.json()

  const usdPrice = pickTcgplayerPrice(tcgdexCard.variants_detailed)
  if (!usdPrice) return null

  const brlRate = await getUsdBrlRate()
  const brlPrice = Math.round(usdPrice * brlRate * 100) / 100

  return { price: brlPrice, source: 'tcgdex_usd' }
}
