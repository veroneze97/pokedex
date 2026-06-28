import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllData, savePriceApi } from '../services/api'
import { fetchPrice } from '../services/pricing'
import { brl, formatDate } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

const TOTAL_CARDS = 130

export default function Dashboard() {
  const navigate = useNavigate()
  const [collection, setCollection]       = useState([])
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
      const { collection: col, prices: priceMap } = await fetchAllData()
      setCollection(col || [])
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
  const progress    = (uniqueOwned / TOTAL_CARDS) * 100
  const avgValue    = uniqueOwned > 0 ? totalValue / uniqueOwned : 0
  const semPreco    = collection.filter(c => !prices[c.card_id]?.price_brl).length

  // Sparkline from sorted price-update timestamps
  const sparkData = Object.values(prices)
    .sort((a, b) => new Date(a.date_recorded) - new Date(b.date_recorded))
    .map(p => p.price_brl)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0A0A0C]">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0A0A0C] pb-28">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="safe-top flex items-center justify-between px-5 pt-3 pb-4">
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

      <div className="px-4 space-y-3">

        {/* ── KPI Block ──────────────────────────────────────────────────────── */}
        <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-5">
          <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-3">
            Valor Total da Coleção
          </p>
          <p
            className="text-[#F4F4F6] font-bold leading-none tabular-nums mb-5"
            style={{ fontSize: 38 }}
          >
            {brl(totalValue)}
          </p>

          <InlineSparkline data={sparkData} />

          {lastUpdate && (
            <p className="text-[#8E8E93] text-[11px] mt-2">
              Atualizado{' '}
              {new Date(lastUpdate).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          )}
        </div>

        {/* ── Metrics 2×2 ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="Cartas"      value={String(uniqueOwned)} sub={`de ${TOTAL_CARDS}`} />
          <MetricCard label="Valor Médio" value={brl(avgValue)} />
          <MetricCard label="Progresso"   value={`${progress.toFixed(1)}%`} sub="da coleção" accent />
          <MetricCard label="Sem Preço"   value={String(semPreco)} sub="itens" />
        </div>

        {/* ── Top 3 Mais Valiosas ─────────────────────────────────────────────── */}
        {top3.length > 0 && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#24242A]">
              <p className="text-[#F4F4F6] text-sm font-semibold">Mais Valiosas</p>
              <button
                onClick={() => navigate('/pokedex')}
                className="text-[#8E8E93] text-[12px] font-medium"
                style={{ minHeight: 44 }}
              >
                Ver todas
              </button>
            </div>
            {top3.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate(`/card/${item.card_id}`)}
                className={`w-full flex items-center gap-3 px-4 active:bg-[#1C1C22] ${
                  i < top3.length - 1 ? 'border-b border-[#24242A]' : ''
                }`}
                style={{ minHeight: 60 }}
              >
                <span className="text-[#8E8E93] text-xs font-medium w-4 text-center tabular-nums">
                  {i + 1}
                </span>
                <div className="w-8 h-11 rounded-md overflow-hidden bg-[#0A0A0C] flex-shrink-0">
                  {item.cards?.image_url && (
                    <img
                      src={item.cards.image_url}
                      alt={item.cards?.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0 py-3.5">
                  <p className="text-[#F4F4F6] text-sm font-medium truncate">{item.cards?.name}</p>
                  <p className="text-[#8E8E93] text-[11px] truncate mt-0.5">
                    {item.cards?.set_code} · #{item.cards?.number}
                  </p>
                </div>
                <p className="text-[#F4F4F6] text-sm font-bold tabular-nums flex-shrink-0 ml-2">
                  {brl(item.price)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ── Confirm update ─────────────────────────────────────────────────── */}
        {confirmUpdate && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-4 space-y-3">
            <p className="text-[#F4F4F6] text-sm font-semibold">Atualizar Preços</p>
            <p className="text-[#8E8E93] text-sm leading-relaxed">
              Buscar preços para {collection.length} carta(s)? Pode levar alguns minutos.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmUpdate(false)}
                className="flex-1 h-11 rounded-xl bg-transparent border border-[#24242A] text-[#8E8E93] text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePrices}
                className="flex-1 h-11 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] text-sm font-semibold"
              >
                Atualizar
              </button>
            </div>
          </div>
        )}

        {/* ── Update progress ────────────────────────────────────────────────── */}
        {updating && (
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-4 space-y-3">
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
          <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-4 space-y-4">
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
                  <div key={i} className="flex justify-between items-center">
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
                  <div key={i} className="flex justify-between items-center">
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

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-[#16161A] border border-[#24242A] rounded-xl p-4">
      <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-xl font-bold tabular-nums leading-none ${accent ? 'text-[#00E676]' : 'text-[#F4F4F6]'}`}>
        {value}
      </p>
      {sub && <p className="text-[#8E8E93] text-[11px] mt-1">{sub}</p>}
    </div>
  )
}

function InlineSparkline({ data }) {
  const W = 300, H = 40, P = 2

  if (!data || data.length < 2) {
    // Decorative fallback
    const decorPts = '0,36 30,32 60,26 90,28 120,20 150,22 180,14 210,16 240,10 270,6 300,4'
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
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
