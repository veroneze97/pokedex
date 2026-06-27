// Todos os acessos ao banco passam pelo servidor (service role key)

export async function fetchAllData() {
  const res = await fetch('/api/cards')
  if (!res.ok) throw new Error('Erro ao carregar dados')
  return res.json() // { cards, collection, prices }
}

export async function addCardToCollection({ number, setCode, name, rarity, imageUrl }) {
  const res = await fetch('/api/collection', {
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
  await fetch('/api/save-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, price, source }),
  })
}
