const TCG_API = 'https://api.pokemontcg.io/v2'
const API_KEY = import.meta.env.VITE_TCG_API_KEY

async function tcgFetch(path) {
  const res = await fetch(`${TCG_API}${path}`, {
    headers: API_KEY ? { 'X-Api-Key': API_KEY } : {},
  })
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`)
  return res.json()
}

export async function searchCard(number, setCode) {
  // number like "008/094", setCode like "PFLpt"
  const num = number.split('/')[0].replace(/^0+/, '')
  const q = `number:${num} set.id:${setCode.toLowerCase()}`
  const data = await tcgFetch(`/cards?q=${encodeURIComponent(q)}&pageSize=5`)
  return data.data?.[0] || null
}

export async function getSetCards(setId = 'sv8pt5') {
  const data = await tcgFetch(`/cards?q=set.id:${setId}&pageSize=250&orderBy=number`)
  return data.data || []
}
