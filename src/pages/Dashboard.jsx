import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllData, savePriceApi } from '../services/api'
import { fetchPrice } from '../services/pricing'
import { brl, formatDate } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

// Fallback caso o catálogo ainda não tenha carregado (130 PFLpt + 188 ME1pt)
const FALLBACK_TOTAL = 318

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) { setValue(0); return }
    const start = Date.now()
    let raf
    function tick() {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [collection, setCollection]       = useState([])
  const [cards, setCards]                 = useState([])
  const [prices, setPrices]               = useState({})
  const [loading, setLoading]             = useState(true)
  const [updating, setUpdating]           = useState(false)
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, name: '' })
  const [lastUpdate, setLastUpdate]       = useState(null)
  const [updateReport, setUpdateReport]   = useState(null)
  const [confirmUpdate, setConfirmUpdate] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { cards: allCards, collection: col, prices: priceMap } = await fetchAllData()
      setCollection(col || [])
      setCards(allCards || [])
      setPrices(priceMap || {})
      if (priceMap && Object.values(priceMap).length > 0) {
        const latest = Object.values(priceMap).sort(
          (a, b) => new Date(b.date_recorded) - new Date(a.date_recorded)
        )[0]
        setLastUpdate(latest.date_recorded)
      }
    } catch (e) {
      console.warn('Erro ao carregar dados:', e.message)
      setCollection([])
      setPrices({})
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePrices() {
    setConfirmUpdate(false)
    setUpdating(true)
    const report = { up: [], down: [], same: [] }
    const BATCH  = 5

    for (let i = 0; i < collection.length; i += BATCH) {
      const batch = collection.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (item) => {
          const card = item.cards
          setUpdateProgress({ current: i + 1, total: collection.length, name: card.name })
          try {
            const result = await fetchPrice(card.name, card.set_code)
            if (result?.price) {
              const prev = prices[card.id]?.price_brl || 0
              const diff = result.price - prev
              if (Math.abs(diff) > 0.01) {
                diff > 0
                  ? report.up.push({ name: card.name, diff })
                  : report.down.push({ name: card.name, diff })
              } else {
                report.same.push({ name: card.name })
              }
              await savePriceApi(card.id, result.price, result.source)
            }
          } catch (e) {
            console.error('Price fetch error:', e)
          }
        })
      )
      if (i + BATCH < collection.length) await sleep(2000)
    }

    setUpdateReport(report)
    setLastUpdate(new Date().toISOString())
    await loadData()
    setUpdating(false)
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalValue  = collection.reduce((sum, item) => {
    return sum + (prices[item.card_id]?.price_brl || 0) * item.quantity
  }, 0)

  const top3 = collection
    .map(item => ({ ...item, price: prices[item.card_id]?.price_brl || 0 }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)

  const uniqueOwned = new Set(collection.map(c => c.card_id)).size
  const totalCards  = cards.length || FALLBACK_TOTAL
  const progress    = (uniqueOwned / totalCards) * 100

  const sparkData = Object.values(prices)
    .sort((a, b) => new Date(a.date_recorded) - new Date(b.date_recorded))
    .map(p => p.price_brl)

  const animatedValue = useCountUp(totalValue)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0A0A0C]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0A0A0C] pb-32">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="safe-top flex items-center justify-between px-5 pt-4 pb-5">
        <div>
          <p className="text-[#8E8E93] text-[10px] font-medium tracking-widest uppercase leading-none mb-1">
            Portfolio
          </p>
          <p className="text-[#F4F4F6] text-[17px] font-bold tracking-tight">Pokémon TCG</p>
        </div>
        <button
          onClick={() => setConfirmUpdate(true)}
          disabled={updating}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#16161A] border border-[#24242A] text-[#8E8E93] active:bg-[#24242A] disabled:opacity-40"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <SyncIcon spinning={updating} />
        </button>
      </div>

      <div className="px-5 space-y-6">

        {/* ── KPI Block ──────────────────────────────────────────────────────── */}
        <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5">
          <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-3">
            Valor Total da Coleção
          </p>
          <p
            className="text-[#F4F4F6] font-bold leading-none tabular-nums mb-5"
            style={{ fontSize: 48 }}
          >
            {brl(animatedValue)}
          </p>

          <InlineSparkline data={sparkData} />

          {lastUpdate && (
            <p className="text-[#8E8E93] text-[11px] mt-3">
              Atualizado{' '}
              {new Date(lastUpdate).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>

        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#16161A] border border-[#24242A] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Cartas</p>
            <p className="text-[#F4F4F6] text-[22px] font-bold tabular-nums leading-none">{uniqueOwned}</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">de {totalCards}</p>
          </div>
          <div className="flex-1 bg-[#16161A] border border-[#24242A] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Progresso</p>
            <p className="text-[#00E676] text-[22px] font-bold tabular-nums leading-none">{progress.toFixed(1)}%</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">da coleção</p>
          </div>
        </div>

        {/* ── Top 3 — horizontal scroll carousel ─────────────────────────────── */}
        {top3.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#F4F4F6] text-[15px] font-semibold">Mais Valiosas</p>
              <button
                onClick={() => navigate('/pokedex')}
                className="text-[#8E8E93] text-[12px] font-medium"
                style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}
              >
                Ver todas
              </button>
            </div>
            <div className="overflow-x-auto scroll-hide -mx-5">
              <div className="flex gap-3 px-5 pb-1" style={{ width: 'max-content' }}>
                {top3.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/card/${item.card_id}`)}
                    className="flex-shrink-0 w-36 bg-[#16161A] border border-[#24242A] rounded-2xl overflow-hidden active:bg-[#1C1C22]"
                  >
                    <div className="w-full" style={{ aspectRatio: '2.5/3.5' }}>
                      {item.cards?.image_url && (
                        <img
                          src={item.cards.image_url}
                          alt={item.cards?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="p-3 text-left">
                      <p className="text-[#F4F4F6] text-[12px] font-semibold truncate leading-snug">
                        {item.cards?.name}
                      </p>
                      <p className="text-[#00E676] text-[13px] font-bold tabular-nums mt-0.5">
                        {brl(item.price)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm update ─────────────────────────────────────────────────── */}
        {confirmUpdate && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5 space-y-4">
            <p className="text-[#F4F4F6] text-sm font-semibold">Atualizar Preços</p>
            <p className="text-[#8E8E93] text-sm leading-relaxed">
              Buscar preços para {collection.length} carta(s)? Pode levar alguns minutos.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmUpdate(false)}
                className="flex-1 h-12 rounded-xl bg-transparent border border-[#24242A] text-[#8E8E93] text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePrices}
                className="flex-1 h-12 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] text-sm font-semibold"
              >
                Atualizar
              </button>
            </div>
          </div>
        )}

        {/* ── Update progress ────────────────────────────────────────────────── */}
        {updating && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[#F4F4F6] text-sm font-semibold">Atualizando preços</p>
              <p className="text-[#8E8E93] text-xs tabular-nums">
                {updateProgress.current}/{updateProgress.total}
              </p>
            </div>
            <div className="bg-[#24242A] rounded-full h-[2px]">
              <div
                className="bg-[#00E676] h-[2px] rounded-full transition-all duration-500"
                style={{
                  width: `${updateProgress.total
                    ? (updateProgress.current / updateProgress.total) * 100
                    : 0}%`
                }}
              />
            </div>
            <p className="text-[#8E8E93] text-[11px] truncate">{updateProgress.name}</p>
          </div>
        )}

        {/* ── Update report ──────────────────────────────────────────────────── */}
        {updateReport && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[#F4F4F6] text-sm font-semibold">Resultado da Atualização</p>
              <button
                onClick={() => setUpdateReport(null)}
                className="w-9 h-9 flex items-center justify-center text-[#8E8E93] text-xl"
              >
                ×
              </button>
            </div>
            {updateReport.up.length > 0 && (
              <div className="space-y-2">
                <p className="text-[#00E676] text-[10px] font-semibold uppercase tracking-widest">
                  ↑ Valorizaram
                </p>
                {updateReport.up.map((c, i) => (
                  <div key={i} className="flex justify-between items-center" style={{ minHeight: 40 }}>
                    <p className="text-[#F4F4F6] text-sm truncate flex-1 mr-3">{c.name}</p>
                    <p className="text-[#00E676] text-sm font-semibold tabular-nums flex-shrink-0">
                      +{brl(c.diff)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {updateReport.down.length > 0 && (
              <div className="space-y-2">
                <p className="text-[#FF3B30] text-[10px] font-semibold uppercase tracking-widest">
                  ↓ Desvalorizaram
                </p>
                {updateReport.down.map((c, i) => (
                  <div key={i} className="flex justify-between items-center" style={{ minHeight: 40 }}>
                    <p className="text-[#F4F4F6] text-sm truncate flex-1 mr-3">{c.name}</p>
                    <p className="text-[#FF3B30] text-sm font-semibold tabular-nums flex-shrink-0">
                      {brl(c.diff)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {updateReport.same.length > 0 && (
              <p className="text-[#8E8E93] text-[11px]">
                {updateReport.same.length} carta(s) sem variação
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InlineSparkline({ data }) {
  const W = 300, H = 64, P = 2

  if (!data || data.length < 2) {
    const decorPts = '0,58 30,52 60,42 90,44 120,32 150,35 180,22 210,25 240,16 270,10 300,6'
    return <SparkSVG pts={decorPts} W={W} H={H} />
  }

  const min   = Math.min(...data)
  const max   = Math.max(...data)
  const range = max - min || 1
  const pts   = data.map((v, i) => {
    const x = P + (i / (data.length - 1)) * (W - P * 2)
    const y = H - P - ((v - min) / range) * (H - P * 2)
    return `${x},${y}`
  }).join(' ')

  return <SparkSVG pts={pts} W={W} H={H} />
}

function SparkSVG({ pts, W, H }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00E676" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" />
      <polyline
        points={pts}
        fill="none"
        stroke="#00E676"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SyncIcon({ spinning }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-5 h-5 ${spinning ? 'pokeball-spin' : ''}`}
    >
      <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  )
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
