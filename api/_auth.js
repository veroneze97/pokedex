// Proteção compartilhada dos endpoints da API.
//
// Se APP_SECRET não estiver configurada no ambiente, a checagem é ignorada
// (fail-open) para não quebrar o deploy antes das env vars existirem —
// um aviso é logado. Configure APP_SECRET (servidor) e VITE_APP_SECRET
// (client, mesmo valor) no Vercel para ativar a proteção.
//
// Nota honesta: o secret embarca no bundle JS, então isso não substitui
// autenticação real — serve para barrar bots/scanners e abuso casual
// dos endpoints que custam dinheiro (Claude Vision) ou escrevem no banco.

export function checkAuth(req, res) {
  const secret = process.env.APP_SECRET
  if (!secret) {
    console.warn('APP_SECRET não configurada — endpoints desprotegidos')
    return true
  }
  if (req.headers['x-app-secret'] === secret) return true
  res.status(401).json({ error: 'Não autorizado' })
  return false
}

// Rate limit best-effort em memória (por instância serverless).
// Não é garantia global, mas corta rajadas de abuso na mesma instância.
const hits = new Map()

export function rateLimit(req, res, { limit = 10, windowMs = 60_000 } = {}) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs)
  if (recent.length >= limit) {
    res.status(429).json({ error: 'Muitas requisições. Aguarde um minuto.' })
    return false
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 1000) hits.clear() // evita crescimento sem limite
  return true
}
