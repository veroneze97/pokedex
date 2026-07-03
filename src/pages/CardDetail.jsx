import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCardDetail, addCardById, updateCollectionItem, removeFromCollection } from '../services/api'
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
  const [busy, setBusy]               = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [paidInput, setPaidInput]     = useState('')

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
      setPaidInput(
        colData?.purchase_price != null ? String(colData.purchase_price).replace('.', ',') : ''
      )
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Ações de coleção ──────────────────────────────────────────────────────
  async function changeQty(delta) {
    if (!colItem || busy) return
    const q = colItem.quantity + delta
    if (q < 1) return
    setBusy(true)
    try {
      const { item } = await updateCollectionItem(id, { quantity: q })
      setColItem(item)
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function savePaid() {
    if (!colItem) return
    const raw = paidInput.trim()
    const current = colItem.purchase_price != null ? String(colItem.purchase_price).replace('.', ',') : ''
    if (raw === current) return
    setBusy(true)
    try {
      const { item } = await updateCollectionItem(id, { purchasePrice: raw === '' ? null : raw })
      setColItem(item)
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function handleRemove() {
    setBusy(true)
    try {
      await removeFromCollection(id)
      setColItem(null)
      setPriceHistory([])
      setConfirmRemove(false)
      setPaidInput('')
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function handleManualAdd() {
    setBusy(true)
    try {
      await addCardById(id)
      await loadCard()
    } catch (e) { console.error(e) } finally { setBusy(false) }
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

  // P&L da carta (preço pago vs valor de mercado)
  const paid       = colItem?.purchase_price || 0
  const cardPnl    = paid > 0 && latestPrice > 0 ? (latestPrice - paid) * colItem.quantity : null
  const cardPnlPct = paid > 0 && latestPrice > 0 ? ((latestPrice - paid) / paid) * 100 : 0
  const ligaUrl    = `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(card.name)}`

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

            {/* ── Minha coleção: quantidade, preço pago, P&L ─────────────────── */}
            {colItem && (
              <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 border-b border-white/[0.06]" style={{ minHeight: 64 }}>
                  <p className="text-[#8E8E93] text-sm">Quantidade</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => changeQty(-1)}
                      disabled={busy || colItem.quantity <= 1}
                      className="pressable w-9 h-9 rounded-lg bg-white/[0.08] text-[#F4F4F6] text-lg font-semibold disabled:opacity-30 flex items-center justify-center"
                    >
                      −
                    </button>
                    <p className="text-[#F4F4F6] text-sm font-bold tabular-nums w-8 text-center">
                      {colItem.quantity}×
                    </p>
                    <button
                      onClick={() => changeQty(1)}
                      disabled={busy}
                      className="pressable w-9 h-9 rounded-lg bg-white/[0.08] text-[#F4F4F6] text-lg font-semibold disabled:opacity-30 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-5 border-b border-white/[0.06]" style={{ minHeight: 64 }}>
                  <p className="text-[#8E8E93] text-sm">Preço pago (un.)</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#8E8E93] text-sm">R$</span>
                    <input
                      value={paidInput}
                      onChange={e => setPaidInput(e.target.value)}
                      onBlur={savePaid}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="bg-transparent text-right text-[#F4F4F6] text-sm font-medium w-20 outline-none placeholder-[#8E8E93]/50"
                      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-between px-5 ${cardPnl !== null ? 'border-b border-white/[0.06]' : ''}`} style={{ minHeight: 64 }}>
                  <p className="text-[#8E8E93] text-sm">Valor total ({colItem.quantity}×)</p>
                  <p className="text-[#F4F4F6] text-sm font-bold tabular-nums">
                    {latestPrice > 0 ? brl(latestPrice * colItem.quantity) : '—'}
                  </p>
                </div>

                {cardPnl !== null && (
                  <div className="flex items-center justify-between px-5" style={{ minHeight: 64 }}>
                    <p className="text-[#8E8E93] text-sm">Resultado</p>
                    <p className={`text-sm font-bold tabular-nums ${cardPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF3B30]'}`}>
                      {cardPnl >= 0 ? '+' : ''}{brl(cardPnl)} ({cardPnlPct >= 0 ? '+' : ''}{cardPnlPct.toFixed(1)}%)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Liga Pokémon — preço do mercado BR */}
            <a
              href={ligaUrl}
              target="_blank"
              rel="noreferrer"
              className="pressable flex items-center justify-between bg-[#101014] border border-white/[0.06] rounded-xl px-5"
              style={{ minHeight: 56 }}
            >
              <span className="text-[#F4F4F6] text-sm font-medium">Ver preços na Liga Pokémon</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#8E8E93]">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>

            {/* Remover da coleção */}
            {colItem && (
              confirmRemove ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="pressable flex-1 h-12 rounded-xl border border-white/[0.06] text-[#8E8E93] text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={busy}
                    className="pressable flex-1 h-12 rounded-xl bg-[#FF3B30] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Confirmar remoção
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="pressable w-full h-12 rounded-xl border border-[#FF3B30]/25 text-[#FF3B30] text-sm font-medium"
                >
                  Remover da coleção
                </button>
              )
            )}

            {/* Não possuída: adicionar manualmente ou escanear */}
            {!colItem && (
              <div className="space-y-3">
                <button
                  onClick={handleManualAdd}
                  disabled={busy}
                  className="pressable w-full h-14 flex items-center justify-center bg-[#F4F4F6] text-[#000000] font-semibold text-sm rounded-xl disabled:opacity-50"
                >
                  {busy ? 'Adicionando...' : 'Adicionar à Coleção'}
                </button>
                <button
                  onClick={() => navigate('/camera', { viewTransition: true })}
                  className="pressable w-full h-12 flex items-center justify-center border border-white/[0.06] text-[#8E8E93] font-medium text-sm rounded-xl"
                >
                  Escanear com Câmera
                </button>
              </div>
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
