import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { savePriceApi, snapshotPortfolio } from '../services/api'
import { getCachedData, invalidateDataCache } from '../services/dataCache'
import { fetchPrice } from '../services/pricing'
import { brl } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'
import OfflineBanner from '../components/OfflineBanner'
import Money from '../components/Money'
import { getTypeGlow } from '../utils/typeColors'

// Fallback caso o catálogo ainda não tenha carregado (soma dos 5 sets ativos)
const FALLBACK_TOTAL = 859

export default function Dashboard() {
  const navigate = useNavigate()
  const [collection, setCollection]       = useState([])
  const [cards, setCards]                 = useState([])
  const [prices, setPrices]               = useState({})
  const [portfolio, setPortfolio]         = useState([])
  const [offline, setOffline]             = useState(false)
  const [loading, setLoading]             = useState(true)
  const [updating, setUpdating]           = useState(false)
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, name: '' })
  const [lastUpdate, setLastUpdate]       = useState(null)
  const [updateReport, setUpdateReport]   = useState(null)
  const [confirmUpdate, setConfirmUpdate] = useState(false)

  function applyData(data) {
    const { cards: allCards, collection: col, prices: priceMap, portfolio: hist, offline: isOffline } = data
    setCollection(col || [])
    setCards(allCards || [])
    setPrices(priceMap || {})
    setPortfolio(hist || [])
    setOffline(!!isOffline)
    if (priceMap && Object.values(priceMap).length > 0) {
      const latest = Object.values(priceMap).sort(
        (a, b) => new Date(b.date_recorded) - new Date(a.date_recorded)
      )[0]
      setLastUpdate(latest.date_recorded)
    }
  }

  async function loadData() {
    try {
      const data = await getCachedData({ onRevalidate: applyData })
      applyData(data)
    } catch (e) {
      console.warn('Erro ao carregar dados:', e.message)
      setCollection([])
      setPrices({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

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
            const result = await fetchPrice(card.number, card.set_code)
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
    await snapshotPortfolio()
    invalidateDataCache()
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

  // P&L: total investido (cartas com preço pago) vs valor de mercado atual
  const invested = collection.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0)
  const pnl      = totalValue - invested
  const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0

  // Evolução do valor total do portfólio (snapshots diários)
  const sparkData = portfolio.map(p => p.total_brl)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#000000]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#000000] pb-32">

      {/* ── Header sticky: o blur só aparece quando conteúdo rola por baixo ── */}
      <div
        className="safe-top sticky top-0 z-40 flex items-center justify-between px-5 pt-4 pb-4"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div>
          <p className="text-[#8E8E93] text-[10px] font-medium tracking-widest uppercase leading-none mb-1">
            Portfolio
          </p>
          <p className="text-[#F4F4F6] text-[17px] font-bold tracking-tight">Pokémon TCG</p>
        </div>
        <button
          onClick={() => setConfirmUpdate(true)}
          disabled={updating}
          className="pressable w-11 h-11 flex items-center justify-center rounded-xl bg-[#101014] border border-white/[0.06] text-[#8E8E93] active:bg-[#1A1A20] disabled:opacity-40"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <SyncIcon spinning={updating} />
        </button>
      </div>

      <div className="px-5 space-y-6">

        {offline && <OfflineBanner />}

        {/* ── Hero de patrimônio — sem caixa, luz própria ──────────────────────── */}
        <div className="relative text-center py-4 overflow-hidden lg:max-w-2xl lg:mx-auto">
          <div
            className="absolute pointer-events-none"
            style={{
              top: -40, left: '50%', transform: 'translateX(-50%)',
              width: 280, height: 200,
              background: 'radial-gradient(ellipse at 50% 30%, rgba(245,166,35,0.35), transparent 65%)',
              filter: 'blur(30px)',
            }}
          />
          <p className="relative text-[#8E8E93] text-[11px] font-medium uppercase tracking-widest mb-2">
            Valor Total da Coleção
          </p>
          <p className="relative leading-none flex justify-center">
            <Money value={totalValue} size={52} rolling gold />
          </p>

          {invested > 0 && (
            <div className="relative flex items-center justify-center gap-2.5 mt-4 mb-1 flex-wrap">
              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                pnl >= 0 ? 'bg-[#00E67614] text-[#00E676]' : 'bg-[#FF3B3014] text-[#FF3B30]'
              }`}>
                {pnl >= 0 ? '↑' : '↓'} {pnl >= 0 ? '+' : ''}{brl(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
              </span>
              <span className="text-[#8E8E93] text-[11px]">investido {brl(invested)}</span>
            </div>
          )}

          <div className="relative mt-5">
            <InlineSparkline data={sparkData} />
          </div>

          {lastUpdate && (
            <p className="relative text-[#8E8E93] text-[11px] mt-3">
              Atualizado{' '}
              {new Date(lastUpdate).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>

        <div className="lg:flex lg:gap-8 lg:items-start">

        {/* ── Metrics chips — Cartas + Progresso ─────────────────────────────── */}
        <div className="flex gap-3 lg:flex-col lg:w-56 lg:flex-shrink-0">
          <div className="flex-1 bg-[#101014] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Cartas</p>
            <p className="text-[#F4F4F6] text-[22px] font-bold tabular-nums leading-none">{uniqueOwned}</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">de {totalCards}</p>
          </div>
          <div className="flex-1 bg-[#101014] rounded-xl p-5">
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">Progresso</p>
            <p className="text-[#F5A623] text-[22px] font-bold tabular-nums leading-none">{progress.toFixed(1)}%</p>
            <p className="text-[#8E8E93] text-[11px] mt-1">da coleção</p>
          </div>
        </div>

        {/* ── Top 3 — horizontal scroll carousel ─────────────────────────────── */}
        {top3.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#F4F4F6] text-[15px] font-semibold">Mais Valiosas</p>
              <button
                onClick={() => navigate('/pokedex', { viewTransition: true })}
                className="text-[#8E8E93] text-[12px] font-medium"
                style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}
              >
                Ver todas
              </button>
            </div>
            <div
              className="overflow-x-auto scroll-hide -mx-5 lg:overflow-visible lg:mx-0"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
              }}
            >
              <div className="flex gap-3 px-5 pb-1 lg:flex-wrap lg:px-0 lg:w-auto" style={{ width: 'max-content' }}>
                {top3.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/card/${item.card_id}`, { viewTransition: true })}
                    className="pressable flex-shrink-0 w-36 rounded-2xl active:opacity-90"
                    style={getTypeGlow(item.cards?.type)}
                  >
                    <div className="relative w-full rounded-2xl overflow-hidden bg-[#101014]" style={{ aspectRatio: '2.5/3.5' }}>
                      {item.cards?.image_url && (
                        <img
                          src={item.cards.image_url}
                          alt={item.cards?.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="holo-sheen" />
                    </div>
                    <div className="p-3 text-left">
                      <p className="text-[#F4F4F6] text-[12px] font-semibold truncate leading-snug">
                        {item.cards?.name}
                      </p>
                      <p className="text-[#F5A623] text-[13px] font-bold tabular-nums mt-0.5">
                        {brl(item.price)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* ── Confirm update ─────────────────────────────────────────────────── */}
        {confirmUpdate && (
          <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <p className="text-[#F4F4F6] text-sm font-semibold">Atualizar Preços</p>
            <p className="text-[#8E8E93] text-sm leading-relaxed">
              Buscar preços para {collection.length} carta(s)? Pode levar alguns minutos.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmUpdate(false)}
                className="pressable flex-1 h-12 rounded-xl bg-transparent border border-white/[0.06] text-[#8E8E93] text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePrices}
                className="pressable flex-1 h-12 rounded-xl bg-[#F4F4F6] text-[#000000] text-sm font-semibold"
              >
                Atualizar
              </button>
            </div>
          </div>
        )}

        {/* ── Update progress ────────────────────────────────────────────────── */}
        {updating && (
          <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[#F4F4F6] text-sm font-semibold">Atualizando preços</p>
              <p className="text-[#8E8E93] text-xs tabular-nums">
                {updateProgress.current}/{updateProgress.total}
              </p>
            </div>
            <div className="bg-white/[0.08] rounded-full h-[2px]">
              <div
                className="bg-[#F5A623] h-[2px] rounded-full transition-all duration-500"
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
          <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5 space-y-4">
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
          <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" className="spark-fill" />
      <polyline
        points={pts}
        pathLength="1"
        className="spark-draw"
        fill="none"
        stroke="#F5A623"
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
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-5 h-5 ${spinning ? 'pokeball-spin' : ''}`}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
