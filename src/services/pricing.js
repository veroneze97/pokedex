import { apiFetch } from './http'

export async function fetchPrice(cardName, setCode) {
  const res = await apiFetch('/api/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardName, setCode }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data // { price, source }
}
