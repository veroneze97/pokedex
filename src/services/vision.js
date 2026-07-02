// Claude Vision via backend proxy (never expose key in frontend)
import { apiFetch } from './http'

export async function identifyCard(base64Image) {
  const res = await apiFetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao identificar a carta')
  }
  return res.json()
  // Returns: { name, number, setCode, rarity, isValidPTBR }
}
