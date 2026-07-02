// fetch com o header de proteção da API.
// VITE_APP_SECRET deve ter o mesmo valor de APP_SECRET no servidor (Vercel env).
const SECRET = import.meta.env.VITE_APP_SECRET

export function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (SECRET) headers['x-app-secret'] = SECRET
  return fetch(path, { ...options, headers })
}
