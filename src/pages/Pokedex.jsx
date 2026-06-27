import React, { useEffect, useState } from 'react'
import { fetchAllData } from '../services/api'
import CardTile from '../components/CardTile'
import PokeballLoader from '../components/PokeballLoader'

const TOTAL = 130

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
  const missing = cards.length - owned
  const progress = cards.length > 0 ? (owned / cards.length) * 100 : 0

  const filtered = cards.filter(card => {
    const has = !!collection[card.id]
    if (filter === 'Possuídas') return has
    if (filter === 'Faltando') return !has
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#080e1c]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#080e1c] pb-28">
      {/* Header */}
      <div className="safe-top flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#3B82F6] rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-white font-black text-base tracking-wide">FOGO FANTASMAGÓRICO</h1>
        </div>
        <div className="flex gap-2 text-gray-500">
          <button>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
          </button>
          <button>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-white font-black text-3xl">{owned}</span>
            <span className="text-gray-500 font-bold text-xl">/ {cards.length || TOTAL}</span>
          </div>
          <p className="text-[#3B82F6] text-sm font-semibold mb-2">{progress.toFixed(0)}% Completo</p>
          <div className="bg-[#1e2d45] rounded-full h-3">
            <div
              className="progress-bar h-3 rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: 'Todas', label: 'Todas as Cartas', icon: '◉' },
            { key: 'Possuídas', label: 'Possuídas', icon: '✓' },
            { key: 'Faltando', label: 'Faltando', icon: '○' },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-colors border ${
                filter === key
                  ? 'bg-[#162035] border-[#3B82F6] text-white'
                  : 'bg-transparent border-[#1e2d45] text-gray-500'
              }`}
            >
              <span className={filter === key ? 'text-[#3B82F6]' : 'text-gray-600'}>{icon}</span>
              {label}
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold border border-[#1e2d45] text-gray-500">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" /></svg>
            Filtro
          </button>
        </div>

        {/* Stats pills */}
        <div className="flex gap-2 text-xs">
          <span className="bg-[#162035] border border-[#1e2d45] rounded-full px-3 py-1 text-gray-400">
            <span className="text-white font-bold">{owned}</span> possuídas
          </span>
          <span className="bg-[#162035] border border-[#1e2d45] rounded-full px-3 py-1 text-gray-400">
            <span className="text-white font-bold">{missing < 0 ? 0 : missing}</span> faltando
          </span>
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
          <p className="text-center text-gray-600 py-12 text-sm">
            Nenhuma carta encontrada
          </p>
        )}

        {/* View toggle */}
        <div className="flex rounded-2xl border border-[#1e2d45] overflow-hidden">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#162035] text-white text-sm font-semibold">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" /></svg>
            Visão do Set
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-500 text-sm font-semibold">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
            Visão PokéDex
          </button>
        </div>
      </div>
    </div>
  )
}
