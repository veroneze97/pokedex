import { apiFetch } from './http'

export async function fetchPrice(number, setCode) {
  const res = await apiFetch('/api/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, setCode }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data // { price, source }
}
