import React, { useEffect, useState } from 'react'
import { fetchAllData } from '../services/api'
import CardTile from '../components/CardTile'
import PokeballLoader from '../components/PokeballLoader'
import OfflineBanner from '../components/OfflineBanner'

// Fallback caso o catálogo ainda não tenha carregado (130 PFLpt + 188 ME1pt)
const TOTAL = 318

export default function Pokedex() {
  const [cards, setCards]           = useState([])
  const [collection, setCollection] = useState({})
  const [prices, setPrices]         = useState({})
  const [filter, setFilter]         = useState('Todas')
  const [loading, setLoading]       = useState(true)
  const [offline, setOffline]       = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { cards: allCards, collection: col, prices: priceMap, offline: isOffline } = await fetchAllData()
      setCards(allCards || [])
      const map = {}
      for (const item of (col || [])) map[item.card_id] = item
      setCollection(map)
      setPrices(priceMap || {})
      setOffline(!!isOffline)
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
      <div className="flex items-center justify-center h-full bg-[#000000]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#000000] pb-32">

      {/* Header sticky com blur ao rolar */}
      <div
        className="safe-top sticky top-0 z-40 flex items-center justify-between px-5 pt-5 pb-4"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div>
          <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-0.5">Coleção</p>
          <h1 className="text-[#F4F4F6] text-[17px] font-bold tracking-tight">Minha Coleção</h1>
        </div>
        <button
          className="pressable w-11 h-11 flex items-center justify-center rounded-xl bg-[#101014] border border-white/[0.06] text-[#8E8E93]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </div>

      <div className="px-5 space-y-5">

        {offline && <OfflineBanner />}

        {/* Progress block */}
        <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#F4F4F6] font-bold text-4xl tabular-nums">{owned}</span>
            <span className="text-[#8E8E93] font-semibold text-2xl">/ {cards.length || TOTAL}</span>
          </div>
          <p className="text-[#00E676] text-sm font-semibold mb-4">{progress.toFixed(0)}% completo</p>
          <div className="bg-white/[0.08] rounded-full h-[3px]">
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
              className={`pressable flex-1 rounded-xl text-[13px] font-semibold border ${
                filter === key
                  ? 'bg-[#101014] border-[#F4F4F6]/20 text-[#F4F4F6]'
                  : 'bg-transparent border-white/[0.06] text-[#8E8E93]'
              }`}
              style={{ minHeight: 52 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats pills */}
        <div className="flex gap-2">
          <span className="bg-[#101014] border border-white/[0.06] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
            <span className="text-[#F4F4F6] font-bold">{owned}</span> possuídas
          </span>
          <span className="bg-[#101014] border border-white/[0.06] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
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
