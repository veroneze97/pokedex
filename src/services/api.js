// Todos os acessos ao banco passam pelo servidor (service role key)
import { apiFetch } from './http'

const CACHE_KEY = 'pokedex-data-v1'

export async function fetchAllData() {
  try {
    const res = await apiFetch('/api/cards')
    if (!res.ok) throw new Error('Erro ao carregar dados')
    const data = await res.json() // { cards, collection, prices, portfolio }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* storage cheio */ }
    return { ...data, offline: false }
  } catch (e) {
    // Sem rede: devolve o último payload salvo para o app seguir utilizável
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) return { ...JSON.parse(cached), offline: true }
    throw e
  }
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

export async function addCardToCollection({ number, setCode, name, rarity, imageUrl, purchasePrice }) {
  const res = await apiFetch('/api/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, setCode, name, rarity, imageUrl, purchasePrice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao salvar carta')
  }
  return res.json()
}

// Adição manual: a carta já existe no catálogo, basta o id
export async function addCardById(cardId, purchasePrice) {
  const res = await apiFetch('/api/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, purchasePrice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao adicionar carta')
  }
  return res.json()
}

export async function updateCollectionItem(cardId, { quantity, purchasePrice }) {
  const res = await apiFetch('/api/collection', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, quantity, purchasePrice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao atualizar')
  }
  return res.json()
}

export async function removeFromCollection(cardId) {
  const res = await apiFetch('/api/collection', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao remover')
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
