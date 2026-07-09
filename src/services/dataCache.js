// Cache em memória sobre fetchAllData(): evita refazer a chamada de rede
// inteira toda vez que o usuário troca de aba (Dashboard <-> Coleção).
// Stale-while-revalidate: devolve o cache na hora e atualiza em background.
import { fetchAllData } from './api'

let cache = null
let inflight = null

export function getCachedData({ onRevalidate } = {}) {
  if (cache) {
    revalidate(onRevalidate)
    return Promise.resolve(cache)
  }
  if (!inflight) {
    inflight = fetchAllData().then(data => {
      cache = data
      inflight = null
      return data
    }).catch(e => {
      inflight = null
      throw e
    })
  }
  return inflight
}

function revalidate(onRevalidate) {
  fetchAllData().then(data => {
    cache = data
    onRevalidate?.(data)
  }).catch(() => { /* mantém o cache atual se a revalidação falhar */ })
}

export function invalidateDataCache() {
  cache = null
  inflight = null
}
