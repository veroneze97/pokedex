import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCachedData } from '../services/dataCache'
import CardTile from '../components/CardTile'
import PokeballLoader from '../components/PokeballLoader'
import OfflineBanner from '../components/OfflineBanner'

// Fallback caso o catálogo ainda não tenha carregado (soma dos 5 sets ativos)
const TOTAL = 859

const SORTS = [
  { key: 'numero', label: 'Número' },
  { key: 'preco',  label: 'Preço' },
  { key: 'nome',   label: 'Nome' },
]

export default function Pokedex() {
  const [cards, setCards]           = useState([])
  const [collection, setCollection] = useState({})
  const [prices, setPrices]         = useState({})
  const [setsList, setSetsList]     = useState([])
  const [filter, setFilter]         = useState('Todas')
  const [loading, setLoading]       = useState(true)
  const [offline, setOffline]       = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeSet, setActiveSetState] = useState(searchParams.get('set') || 'all')
  const [query, setQuery]           = useState('')
  const [sortIdx, setSortIdx]       = useState(0)

  useEffect(() => { loadAll() }, [])

  // Mantém activeSet em sincronia com ?set= na URL — permite deep link
  // (ex: a Sidebar do desktop navega direto pra /pokedex?set=me04-en)
  useEffect(() => {
    setActiveSetState(searchParams.get('set') || 'all')
  }, [searchParams])

  function setActiveSet(code) {
    setActiveSetState(code)
    setSearchParams(code === 'all' ? {} : { set: code })
  }

  function applyData(data) {
    const { cards: allCards, collection: col, prices: priceMap, offline: isOffline, sets: setsData } = data
    setCards(allCards || [])
    const map = {}
    for (const item of (col || [])) map[item.card_id] = item
    setCollection(map)
    setPrices(priceMap || {})
    setSetsList(setsData || [])
    setOffline(!!isOffline)
  }

  async function loadAll() {
    try {
      const data = await getCachedData({ onRevalidate: applyData })
      applyData(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Cartas do set selecionado — progresso e contagens acompanham a seleção
  const cardsInSet = activeSet === 'all' ? cards : cards.filter(c => c.set_code === activeSet)
  const owned    = cardsInSet.filter(c => collection[c.id]).length
  const missing  = cardsInSet.length - owned
  const progress = cardsInSet.length > 0 ? (owned / cardsInSet.length) * 100 : 0

  const q = query.trim().toLowerCase()
  const sortKey = SORTS[sortIdx].key

  const sorted = useMemo(() => {
    const filtered = cardsInSet.filter(card => {
      const has = !!collection[card.id]
      if (filter === 'Possuídas' && !has) return false
      if (filter === 'Faltando' && has) return false
      if (q && !(
        card.name?.toLowerCase().includes(q) ||
        String(card.number || '').includes(q)
      )) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'preco') {
        return (prices[b.id]?.price_brl || 0) - (prices[a.id]?.price_brl || 0)
      }
      if (sortKey === 'nome') {
        return (a.name || '').localeCompare(b.name || '', 'pt-BR')
      }
      return Number(a.number) - Number(b.number)
    })
  }, [cardsInSet, collection, prices, filter, q, sortKey])

  const setChips = [
    { code: 'all', label: 'Todos' },
    ...setsList.map(s => ({ code: s.id, label: s.name })),
  ]

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

        {/* Seletor de set — scroll horizontal por toque (mobile) ou roda do mouse (desktop) */}
        <div
          className="flex gap-2 overflow-x-auto scroll-hide -mx-5 px-5"
          onWheel={e => {
            if (e.deltaY === 0) return
            e.currentTarget.scrollLeft += e.deltaY
          }}
        >
          {setChips.map(s => (
            <button
              key={s.code}
              onClick={() => setActiveSet(s.code)}
              className={`pressable flex-shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold ${
                activeSet === s.code
                  ? 'bg-[#F4F4F6] text-[#000000]'
                  : 'bg-[#101014] border border-white/[0.06] text-[#8E8E93]'
              }`}
              style={{ minHeight: 40 }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Progress block — sem caixa, hierarquia grande→pequeno */}
        <div className="px-1 py-2">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#F4F4F6] font-bold text-5xl tabular-nums tracking-tight">{owned}</span>
            <span className="text-[#8E8E93] font-semibold text-2xl">/ {cardsInSet.length || TOTAL}</span>
          </div>
          <p className="text-[#F5A623] text-sm font-semibold mb-4">{progress.toFixed(0)}% completo</p>
          <div className="bg-white/[0.08] rounded-full h-[3px]">
            <div
              className="progress-bar h-[3px] rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Busca por nome ou número */}
        <div className="flex items-center gap-2.5 bg-[#101014] border border-white/[0.06] rounded-xl px-4" style={{ minHeight: 48 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#8E8E93] flex-shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou número"
            className="flex-1 bg-transparent text-sm text-[#F4F4F6] outline-none placeholder-[#8E8E93]/60"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="pressable w-6 h-6 flex items-center justify-center rounded-full bg-white/[0.08] text-[#8E8E93] text-xs flex-shrink-0"
            >
              ×
            </button>
          )}
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

        {/* Stats pills + ordenação */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <span className="bg-[#101014] border border-white/[0.06] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
              <span className="text-[#F4F4F6] font-bold">{owned}</span> possuídas
            </span>
            <span className="bg-[#101014] border border-white/[0.06] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]">
              <span className="text-[#F4F4F6] font-bold">{missing < 0 ? 0 : missing}</span> faltando
            </span>
          </div>
          <button
            onClick={() => setSortIdx((sortIdx + 1) % SORTS.length)}
            className="pressable flex items-center gap-1.5 bg-[#101014] border border-white/[0.06] rounded-full px-3 py-1.5 text-[12px] text-[#8E8E93]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="m3 8 4-4 4 4" />
              <path d="M7 4v16" />
              <path d="m21 16-4 4-4-4" />
              <path d="M17 20V4" />
            </svg>
            {SORTS[sortIdx].label}
          </button>
        </div>

        {/* Card grid — 2 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map((card, index) => (
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

        {sorted.length === 0 && (
          <p className="text-center text-[#8E8E93] py-12 text-sm">Nenhuma carta encontrada</p>
        )}

      </div>
    </div>
  )
}
