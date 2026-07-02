import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCardDetail } from '../services/api'
import { brl, rarityLabel, formatDate, diffLabel } from '../utils/format'
import PriceChart from '../components/PriceChart'
import PokeballLoader from '../components/PokeballLoader'
import Money from '../components/Money'

const PERIODS = ['1M', '3M', '6M', 'MAX']

export default function CardDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [card, setCard]               = useState(null)
  const [colItem, setColItem]         = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('RAW')
  const [period, setPeriod]           = useState('MAX')
  const [tilt, setTilt]               = useState({ x: 0, y: 0 })

  function handleTilt(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 14, y: px * 14 })
  }
  const resetTilt = () => setTilt({ x: 0, y: 0 })

  useEffect(() => { loadCard() }, [id])

  async function loadCard() {
    try {
      const { card: cardData, colItem: colData, priceHistory: hist } = await fetchCardDetail(id)
      setCard(cardData)
      setColItem(colData)
      setPriceHistory(hist || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredHistory = useMemo(() => {
    if (period === 'MAX') return priceHistory
    const cutoff = new Date()
    if (period === '1M') cutoff.setMonth(cutoff.getMonth() - 1)
    else if (period === '3M') cutoff.setMonth(cutoff.getMonth() - 3)
    else if (period === '6M') cutoff.setMonth(cutoff.getMonth() - 6)
    return priceHistory.filter(h => new Date(h.date_recorded) >= cutoff)
  }, [priceHistory, period])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#000000]">
        <PokeballLoader />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#000000] gap-3">
        <p className="text-[#8E8E93] text-sm">Carta não encontrada</p>
        <button onClick={() => navigate(-1)} className="text-[#F4F4F6] text-sm underline">
          Voltar
        </button>
      </div>
    )
  }

  const latestPrice = priceHistory[priceHistory.length - 1]?.price_brl || 0
  const firstPrice  = priceHistory[0]?.price_brl || 0
  const diff        = diffLabel(latestPrice, firstPrice)
  const isUltra     = card.rarity?.includes('Ultra') || card.rarity?.includes('Special') || card.rarity?.includes('Hyper') || card.rarity?.includes('Mega')

  const chartHistory = filteredHistory.length > 1 ? filteredHistory : priceHistory

  return (
    <div className="min-h-full bg-[#000000] pb-32">

      {/* ── Header sticky com blur ao rolar ────────────────────────────────── */}
      <div
        className="safe-top sticky top-0 z-40 flex items-center justify-between px-5 pt-3 pb-2"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="pressable w-11 h-11 flex items-center justify-center bg-[#101014] border border-white/[0.06] rounded-xl text-[#F4F4F6]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
        <h1 className="text-[#F4F4F6] text-sm font-semibold">Detalhes da Carta</h1>
        <button
          className="pressable w-11 h-11 flex items-center justify-center bg-[#101014] border border-white/[0.06] rounded-xl text-[#8E8E93]"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </div>

      {/* ── Card image — 46vh, glow ambiente + tilt 3D ─────────────────────── */}
      <div
        className="relative flex justify-center items-center overflow-hidden"
        style={{ height: '46vh', paddingLeft: 28, paddingRight: 28 }}
      >
        {/* Glow ambiente: a própria carta desfocada "ilumina" a tela */}
        <img
          src={card.image_url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ filter: 'blur(60px) saturate(1.5)', opacity: 0.35, transform: 'scale(1.15)' }}
        />
        <img
          src={card.image_url}
          alt={card.name}
          className="relative h-full w-auto object-contain rounded-xl"
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
          onPointerUp={resetTilt}
          onPointerCancel={resetTilt}
          style={{
            maxWidth: '72vw',
            zIndex: 1,
            // pan-y: tilt no toque sem bloquear o scroll vertical da página
            touchAction: 'pan-y',
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.18s ease-out',
            filter: isUltra
              ? 'drop-shadow(0 0 20px rgba(234,179,8,0.22)) drop-shadow(0 20px 56px rgba(0,0,0,0.9))'
              : 'drop-shadow(0 20px 56px rgba(0,0,0,0.9))',
          }}
        />
      </div>

      <div className="px-5 pt-6 space-y-4">

        {/* ── Card identity ───────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[#F4F4F6] text-[22px] font-bold leading-snug">{card.name}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
            <span className="text-[#8E8E93] text-sm">{card.set_name || card.set_code}</span>
            {card.number && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-[#8E8E93] text-sm">#{card.number}</span>
              </>
            )}
            {card.rarity && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isUltra
                  ? 'bg-[#241800] text-[#FFB800]'
                  : 'bg-[#101014] border border-white/[0.06] text-[#8E8E93]'
              }`}>
                {rarityLabel[card.rarity] || card.rarity}
              </span>
            )}
          </div>
        </div>

        {/* ── Segmented control (iOS-style) ─────────────────────────────────── */}
        <div className="flex bg-[#101014] border border-white/[0.06] rounded-xl p-1 gap-1">
          {['RAW', 'GRADED', 'POP'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pressable flex-1 rounded-lg text-[13px] font-semibold transition-colors ${
                tab === t ? 'bg-[#F4F4F6] text-[#000000]' : 'text-[#8E8E93]'
              }`}
              style={{ minHeight: 44 }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── RAW tab content ────────────────────────────────────────────────── */}
        {tab === 'RAW' ? (
          <>
            {/* Price */}
            <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5">
              <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">
                Preço Atual (BRL)
              </p>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[#F4F4F6] leading-none">
                  {latestPrice > 0
                    ? <Money value={latestPrice} size={30} />
                    : <span className="text-3xl font-bold">—</span>}
                </p>
                {diff && (
                  <span className={`badge-pulse flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0 ${
                    diff.positive
                      ? 'bg-[#00E67614] text-[#00E676]'
                      : 'bg-[#FF3B3014] text-[#FF3B30]'
                  }`}>
                    {diff.positive ? '↑' : '↓'} {diff.label}
                  </span>
                )}
              </div>
            </div>

            {/* Market history chart */}
            {colItem && priceHistory.length > 1 && (
              <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-5 space-y-3">
                <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest">
                  Histórico de Mercado
                </p>
                <PriceChart history={chartHistory} />
                {/* Period selectors */}
                <div className="flex gap-1.5 pt-1">
                  {PERIODS.map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`pressable flex-1 rounded-lg text-[12px] font-semibold transition-colors ${
                        period === p
                          ? 'bg-white/[0.08] text-[#F4F4F6]'
                          : 'text-[#8E8E93]'
                      }`}
                      style={{ minHeight: 40 }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Details list */}
            <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
              <DetailRow label="Coleção"   value={card.set_name || card.set_code || '—'} />
              <DetailRow label="Número"    value={card.number ? `#${card.number}` : '—'} />
              <DetailRow label="Ilustrador" value={card.illustrator || '—'} />
              {colItem
                ? <>
                    <DetailRow label="Estado"    value="Near Mint (NM)" />
                    <DetailRow label="Adicionado" value={formatDate(colItem.date_added)} last />
                  </>
                : <DetailRow label="Lançamento" value={card.release_date ? formatDate(card.release_date) : '—'} last />
              }
            </div>

            {/* Collection stats */}
            {colItem && (
              <div className="bg-[#101014] border border-white/[0.06] rounded-xl flex divide-x divide-white/[0.06]">
                <div className="flex-1 flex flex-col items-center py-5 gap-1">
                  <p className="text-[#F4F4F6] text-xl font-bold tabular-nums">{colItem.quantity}×</p>
                  <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-wider">Quantidade</p>
                </div>
                <div className="flex-1 flex flex-col items-center py-5 gap-1">
                  <p className="text-[#F4F4F6] text-[17px] font-bold tabular-nums">
                    {latestPrice > 0 ? brl(latestPrice * colItem.quantity) : '—'}
                  </p>
                  <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-wider">Valor Total</p>
                </div>
              </div>
            )}

            {/* Not owned CTA */}
            {!colItem && (
              <button
                onClick={() => navigate('/camera', { viewTransition: true })}
                className="pressable w-full h-14 flex items-center justify-center bg-[#F4F4F6] text-[#000000] font-semibold text-sm rounded-xl"
              >
                Adicionar via Câmera
              </button>
            )}
          </>
        ) : (
          /* GRADED / POP placeholder */
          <div className="bg-[#101014] border border-white/[0.06] rounded-xl p-10 flex flex-col items-center gap-2">
            <p className="text-[#F4F4F6] text-sm font-semibold">{tab}</p>
            <p className="text-[#8E8E93] text-sm text-center">Dados de grading em breve</p>
          </div>
        )}

      </div>
    </div>
  )
}

function DetailRow({ label, value, last }) {
  return (
    <div
      className={`flex items-center justify-between px-5 ${last ? '' : 'border-b border-white/[0.06]'}`}
      style={{ minHeight: 64 }}
    >
      <p className="text-[#8E8E93] text-sm">{label}</p>
      <p className="text-[#F4F4F6] text-sm font-medium text-right max-w-[55%] truncate">{value}</p>
    </div>
  )
}
