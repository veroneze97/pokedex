// Todos os acessos ao banco passam pelo servidor (service role key)
import { apiFetch } from './http'

export async function fetchAllData() {
  const res = await apiFetch('/api/cards')
  if (!res.ok) throw new Error('Erro ao carregar dados')
  return res.json() // { cards, collection, prices, portfolio }
}

export async function snapshotPortfolio() {
  // Best-effort: grava o snapshot do dia após atualizar preços em lote
  await apiFetch('/api/portfolio-snapshot', { method: 'POST' }).catch(() => {})
}

export async function fetchCardDetail(id) {
  const res = await apiFetch(`/api/card-detail?id=${encodeURIComponent(id)}`)
  if (!res.ok) {
    if (res.status === 404) return { card: null, colItem: null, priceHistory: [] }
    throw new Error('Erro ao carregar carta')
  }
  return res.json() // { card, colItem, priceHistory }
}

export async function addCardToCollection({ number, setCode, name, rarity, imageUrl }) {
  const res = await apiFetch('/api/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, setCode, name, rarity, imageUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao salvar carta')
  }
  return res.json()
}

export async function savePriceApi(cardId, price, source) {
  await apiFetch('/api/save-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, price, source }),
  })
}
