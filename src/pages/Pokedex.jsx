import React, { useEffect, useState } from 'react'
import { fetchAllData } from '../services/api'
import CardTile from '../components/CardTile'
import PokeballLoader from '../components/PokeballLoader'

const TOTAL = 130

export default function Pokedex() {
  const [cards, setCards]           = useState([])
  const [collection, setCollection] = useState({})
  const [prices, setPrices]         = useState({})
  const [filter, setFilter]         = useState('Todas')
  const [loading, setLoading]       = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { cards: allCards, collection: col, prices: priceMap } = await fetchAllData()
      setCards(allCards || [])
      const map = {}
      for (const item of (col || [])) map[item.card_id] = item
      setCollection(map)
      setPrices(priceMap || {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const owned    = Object.keys(collection).length
  const missing  = cards.length - owned
  const progress = cards.length > 0 ? (owned / cards.length) * 100 : 0

  const filtered = cards.filter(card => {
    const has = !!collection[card.id]
    if (filter === 'Possuídas') return has
    if (filter === 'Faltando')  return !has
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0A0A0C]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0A0A0C] pb-32">

      {/* Header */}
      <div className="safe-top flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-0.5">Coleção</p>
          <h1 className="text-[#F4F4F6] text-[17px] font-bold tracking-tight">Minha Coleção</h1>
        </div>
        <button
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#16161A] border border-[#24242A] text-[#8E8E93]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      <div className="px-5 space-y-5">

        {/* Progress block */}
        <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#F4F4F6] font-bold text-4xl tabular-nums">{owned}</span>
            <span className="text-[#8E8E93] font-semibold text-2xl">/ {cards.length || TOTAL}</span>
          </div>
          <p className="text-[#00E676] text-sm font-semibold mb-4">{progress.toFixed(0)}% completo</p>
          <div className="bg-[#24242A] rounded-full h-[3px]">
            <div
              className="progress-bar h-[3px] rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: 'Todas',     label: 'Todas' },
            { key: 'Possuídas', label: 'Possuídas' },
            { key: 'Faltando',  label: 'Faltando' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-xl text-[13px] font-semibold border transition-colors ${
                filter === key
                  ? 'bg-[#16161A] border-[#F4F4F6]/20 text-[#F4F4F6]'
                  : 'bg-transparent border-[#24242A] text-[#8E8E93]'
              }`}
              style={{ minHeight: 52 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats pills */}
        <div className="flex gap-2">
          <span className="bg-[#16161A] border border-[#24242A] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
            <span className="text-[#F4F4F6] font-bold">{owned}</span> possuídas
          </span>
          <span className="bg-[#16161A] border border-[#24242A] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
            <span className="text-[#F4F4F6] font-bold">{missing < 0 ? 0 : missing}</span> faltando
          </span>
        </div>

        {/* Card grid — 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((card, index) => (
            <CardTile
              key={card.id}
              card={card}
              owned={!!collection[card.id]}
              quantity={collection[card.id]?.quantity}
              price={prices[card.id]?.price_brl}
              index={index}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-[#8E8E93] py-12 text-sm">Nenhuma carta encontrada</p>
        )}

      </div>
    </div>
  )
}
