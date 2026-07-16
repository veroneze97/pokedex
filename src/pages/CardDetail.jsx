import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCardDetail, addCardById, updateCollectionItem, removeFromCollection } from '../services/api'
import { invalidateDataCache } from '../services/dataCache'
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

  const loadCard = useCallback(async () => {
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
  }, [id])

  useEffect(() => { loadCard() }, [loadCard])

  // ── Ações de coleção ──────────────────────────────────────────────────────
  async function changeQty(delta) {
    if (!colItem || busy) return
    const q = colItem.quantity + delta
    if (q < 1) return
    setBusy(true)
    try {
      const { item } = await updateCollectionItem(id, { quantity: q })
      setColItem(item)
      invalidateDataCache()
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
      invalidateDataCache()
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
      invalidateDataCache()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function handleManualAdd() {
    setBusy(true)
    try {
      await addCardById(id)
      invalidateDataCache()
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
    <div className="min-h-full bg-[#000000] pb-32 lg:flex lg:gap-10 lg:items-start lg:pb-16">

      {/* ── Palco de revelação: a carta respira sozinha, luz direcional de cima ──
          Sem header/barra fixa aqui — só o botão de voltar flutuante, como nos
          mockups validados. Dados (preço, gráfico, ficha) ficam abaixo, ao rolar. */}
      <div
        className="safe-top relative flex flex-col items-center justify-end overflow-hidden pb-7 lg:w-[42%] lg:flex-shrink-0 lg:sticky lg:top-10 lg:rounded-3xl lg:pb-10"
        style={{ height: '58vh' }}
      >
        {/* Spotlight: luz direcional vinda de cima, não glow difuso uniforme */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -140, left: '50%', transform: 'translateX(-50%)',
            width: 520, height: 420,
            background: 'conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(245,166,35,0.22) 35deg, rgba(245,166,35,0.5) 90deg, rgba(245,166,35,0.22) 145deg, transparent 180deg)',
            filter: 'blur(50px)',
            opacity: 0.9,
          }}
        />
        {/* Glow no "chão", sob a carta */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 90, left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 56,
            background: 'radial-gradient(ellipse, rgba(245,166,35,0.4), transparent 70%)',
            filter: 'blur(18px)',
          }}
        />

        <button
          onClick={() => navigate(-1)}
          className="pressable absolute top-4 left-4 z-10 flex items-center justify-center rounded-full text-[#F4F4F6]"
          style={{
            width: 44, height: 44,
            background: 'rgba(20,20,20,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>

        <img
          src={card.image_url}
          alt={card.name}
          className="relative z-[2] w-auto object-contain rounded-xl"
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
          onPointerUp={resetTilt}
          onPointerCancel={resetTilt}
          style={{
            // Não usa h-full: o palco também precisa caber nome/preço/indício
            // de scroll abaixo da carta dentro dos mesmos 58vh (overflow
            // hidden) — h-full fazia só a imagem já ocupar 100% da altura,
            // cortando o topo da carta pra abrir espaço pro texto embaixo.
            height: '52%',
            maxWidth: '68vw',
            // pan-y: tilt no toque sem bloquear o scroll vertical da página
            touchAction: 'pan-y',
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.18s ease-out',
            filter: isUltra
              ? 'drop-shadow(0 0 24px rgba(245,166,35,0.35)) drop-shadow(0 45px 80px rgba(0,0,0,0.95))'
              : 'drop-shadow(0 0 60px rgba(245,166,35,0.18)) drop-shadow(0 45px 80px rgba(0,0,0,0.95))',
          }}
        />

        {/* Identidade — nome grande e confiante, sem caixa */}
        <div className="relative z-[2] text-center mt-6 px-8">
          <p className="text-[#F5A623] text-[11px] font-bold uppercase tracking-widest opacity-85">
            {(card.set_name || card.set_code || '')}{card.rarity ? ` · ${rarityLabel[card.rarity] || card.rarity}` : ''}
          </p>
          <h2 className="text-[#F4F4F6] text-[26px] font-extrabold tracking-tight mt-1">{card.name}</h2>
          {latestPrice > 0 && (
            <p className="text-[#8E8E93] text-sm mt-2">
              Vale hoje <span className="text-[#F4F4F6] font-semibold">{brl(latestPrice)}</span>
              {diff && (
                <span className={diff.positive ? 'text-[#00E676]' : 'text-[#FF3B30]'}>
                  {' '}· {diff.positive ? '↑' : '↓'} {diff.label}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Indício de scroll */}
        <div className="relative z-[2] flex flex-col items-center gap-1 mt-5 opacity-50 lg:hidden">
          <span className="text-[#8E8E93] text-[9px] uppercase tracking-widest">Ver detalhes</span>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-3.5 h-3.5" style={{ animation: 'bob 1.6s ease-in-out infinite' }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-4 lg:flex-1 lg:pt-10">

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
            {/* Price — solto, sem caixa, mesmo tratamento de luz do hero */}
            <div className="text-center py-2">
              <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest mb-2">
                Preço Atual (BRL)
              </p>
              <div className="flex items-center justify-center">
                {latestPrice > 0
                  ? <Money value={latestPrice} size={36} gold />
                  : <span className="text-3xl font-bold text-[#F4F4F6]">—</span>}
              </div>
              {diff && (
                <span className={`badge-pulse inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full mt-3 ${
                  diff.positive
                    ? 'bg-[#00E67614] text-[#00E676]'
                    : 'bg-[#FF3B3014] text-[#FF3B30]'
                }`}>
                  {diff.positive ? '↑' : '↓'} {diff.label}
                </span>
              )}
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

            {/* Metadados — badges em grid, não lista de linhas */}
            <div className="grid grid-cols-2 gap-2.5">
              <MetaBadge label="Coleção" value={card.set_name || card.set_code || '—'} />
              <MetaBadge label="Número" value={card.number ? `#${card.number}` : '—'} />
              {card.rarity && (
                <MetaBadge label="Raridade" value={rarityLabel[card.rarity] || card.rarity} gold={isUltra} />
              )}
              <MetaBadge
                label={colItem ? 'Estado' : 'Lançamento'}
                value={colItem ? 'Near Mint (NM)' : (card.release_date ? formatDate(card.release_date) : '—')}
              />
            </div>

            <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
              <DetailRow label="Ilustrador" value={card.illustrator || '—'} last={!colItem} />
              {colItem && <DetailRow label="Adicionado" value={formatDate(colItem.date_added)} last />}
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
                  className="pressable w-full h-14 flex items-center justify-center font-semibold text-sm rounded-xl disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, #F5A623, #E8871E)',
                    color: '#1a0f00',
                    boxShadow: '0 12px 30px rgba(245,166,35,0.3)',
                  }}
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

function MetaBadge({ label, value, gold }) {
  return (
    <div className="bg-[#101014] border border-white/[0.06] rounded-xl px-4 py-3">
      <p className="text-[#8E8E93] text-[9px] font-medium uppercase tracking-widest">{label}</p>
      <p className={`text-[13px] font-bold mt-1 truncate ${gold ? 'text-[#F5A623]' : 'text-[#F4F4F6]'}`}>{value}</p>
    </div>
  )
}
