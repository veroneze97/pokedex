import React, { useEffect, useState } from 'react'
import { fetchAllData } from '../services/api'
import CardTile from '../components/CardTile'
import PokeballLoader from '../components/PokeballLoader'

const FILTERS = ['Todas', 'Possuídas', 'Não possuídas', 'Comum', 'Incomum', 'Rara', 'Ultra Rara']
const TOTAL = 94

export default function Pokedex() {
  const [cards, setCards] = useState([])
  const [collection, setCollection] = useState({})
  const [filter, setFilter] = useState('Todas')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const { cards: allCards, collection: col } = await fetchAllData()
      setCards(allCards || [])
      const map = {}
      for (const item of (col || [])) map[item.card_id] = item
      setCollection(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const owned = Object.keys(collection).length

  const filtered = cards.filter(card => {
    const has = !!collection[card.id]
    if (filter === 'Possuídas') return has
    if (filter === 'Não possuídas') return !has
    if (filter === 'Comum') return card.rarity === 'Common'
    if (filter === 'Incomum') return card.rarity === 'Uncommon'
    if (filter === 'Rara') return card.rarity?.includes('Rare') && !card.rarity?.includes('Ultra')
    if (filter === 'Ultra Rara') return card.rarity?.includes('Ultra') || card.rarity?.includes('Special') || card.rarity?.includes('Hyper')
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PokeballLoader text="Carregando PokéDex..." />
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="safe-top pt-4">
        <h1 className="text-xl font-bold text-white mb-1">PokéDex</h1>
        <p className="text-xs text-gray-400 mb-3">Fogo Fantasmagórico — PFLpt</p>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-[#333] rounded-full h-3">
            <div className="progress-bar h-3 rounded-full" style={{ width: `${(owned / TOTAL) * 100}%` }} />
          </div>
          <span className="text-xs text-gray-300 font-semibold whitespace-nowrap">{owned} / {TOTAL}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto scroll-hide pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-pokered text-white'
                : 'bg-[#2a2a2a] text-gray-400 border border-[#444]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2">
        {filtered.map(card => (
          <CardTile
            key={card.id}
            card={card}
            owned={!!collection[card.id]}
            quantity={collection[card.id]?.quantity}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-12 text-sm">
          Nenhuma carta encontrada
        </p>
      )}
    </div>
  )
}
