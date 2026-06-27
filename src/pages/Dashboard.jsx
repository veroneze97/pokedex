import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllData, savePriceApi } from '../services/api'
import { fetchPrice } from '../services/pricing'
import { brl, formatDate } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

const TOTAL_CARDS = 130
const TOTAL_SETS = 45

export default function Dashboard() {
  const navigate = useNavigate()
  const [collection, setCollection] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0, name: '' })
  const [lastUpdate, setLastUpdate] = useState(null)
  const [updateReport, setUpdateReport] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

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
    if (!window.confirm(`Atualizar preço de ${collection.length} carta(s)? Pode levar alguns minutos.`)) return
    setUpdating(true)
    const report = { up: [], down: [], same: [] }
    const BATCH = 5

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

  const totalValue = collection.reduce((sum, item) => {
    const p = prices[item.card_id]?.price_brl || 0
    return sum + p * item.quantity
  }, 0)

  const top3 = collection
    .map(item => ({ ...item, price: prices[item.card_id]?.price_brl || 0 }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)

  const uniqueOwned = new Set(collection.map(c => c.card_id)).size
  const progress = (uniqueOwned / TOTAL_CARDS) * 100

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
        <button className="p-1 text-gray-400">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <PokeBallSVG />
            <div>
              <p className="text-white font-black text-sm leading-none tracking-widest">POKÉMON</p>
              <p className="text-[#3B82F6] text-[9px] font-semibold tracking-widest">COLLECTION TRACKER</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 text-gray-400">
          <button>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
          </button>
          <button className="relative">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#EAB308] rounded-full text-[8px] font-bold text-black flex items-center justify-center">3</span>
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Valor total */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0f1929] to-[#0a1830] border border-[#1e3a5f]/60 p-5">
          {/* Charizard watermark */}
          <div className="absolute right-0 top-0 bottom-0 w-40 opacity-10 pointer-events-none select-none flex items-center justify-end pr-2">
            <svg viewBox="0 0 100 120" className="w-36 h-36 text-[#EAB308]" fill="currentColor">
              <ellipse cx="50" cy="60" rx="30" ry="40" opacity="0.5" />
              <ellipse cx="70" cy="40" rx="15" ry="20" opacity="0.4" />
              <path d="M40 100 Q50 110 60 100 Q55 90 50 95 Q45 90 40 100Z" opacity="0.6" />
            </svg>
          </div>
          <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-widest mb-2">VALOR TOTAL DA COLEÇÃO</p>
          <p className="text-4xl font-black text-[#EAB308] mb-1">{brl(totalValue)}</p>
          {/* Trend line placeholder */}
          <svg viewBox="0 0 120 30" className="w-28 h-7 mb-3">
            <polyline points="0,25 20,20 40,22 60,15 80,18 100,10 120,8" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[#166534]/40 border border-[#166534]/60 rounded-full px-2 py-0.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#4ADE80]"><path d="M7 14l5-5 5 5z" /></svg>
              <span className="text-[#4ADE80] text-xs font-bold">+12,5%</span>
            </div>
            <span className="text-gray-500 text-xs">vs. último mês</span>
          </div>
        </div>

        {/* Progresso */}
        <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
          <p className="text-[#94A3B8] text-[10px] font-semibold uppercase tracking-widest mb-3">PROGRESSO GERAL DA COLEÇÃO</p>
          <div className="flex items-end gap-3 mb-3">
            <p className="text-4xl font-black text-[#3B82F6]">{progress.toFixed(1)}%</p>
            <p className="text-gray-400 text-sm mb-1">{uniqueOwned} / {TOTAL_CARDS} <span className="text-gray-600">cartas necessárias</span></p>
          </div>
          <div className="bg-[#1e2d45] rounded-full h-2.5 mb-4">
            <div className="progress-bar h-2.5 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatChip label="CARTAS" value={uniqueOwned} sub={`/ ${TOTAL_CARDS}`} color="text-white" />
            <StatChip label="CONJUNTOS" value={Math.ceil(uniqueOwned / 30)} sub={`/ ${TOTAL_SETS}`} color="text-[#A855F7]" icon="★" />
            <StatChip label="COMPLETOS" value={0} sub={`/ ${TOTAL_SETS}`} color="text-[#22C55E]" icon="✓" />
            <StatChip label="SELVAGENS" value={collection.filter(c => !prices[c.card_id]?.price_brl).length} color="text-[#06B6D4]" icon="◆" />
          </div>
        </div>

        {/* Top 3 cartas mais valiosas */}
        {top3.length > 0 && (
          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[#EAB308] text-base">👑</span>
                <p className="text-white font-bold text-sm tracking-wide">TOP {top3.length} CARTAS MAIS VALIOSAS</p>
              </div>
              <button onClick={() => navigate('/pokedex')} className="text-[#3B82F6] text-xs font-semibold">
                VER TODAS &gt;
              </button>
            </div>
            <div className="flex gap-3">
              {top3.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/card/${item.card_id}`)}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="relative w-full">
                    <div className={`absolute -top-2 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black z-10 ${
                      i === 0 ? 'bg-[#EAB308] text-black' :
                      i === 1 ? 'bg-[#94A3B8] text-black' :
                      'bg-[#D97706] text-black'
                    }`}>{i + 1}</div>
                    <img
                      src={item.cards?.image_url}
                      alt={item.cards?.name}
                      className={`w-full rounded-xl object-cover shadow-lg ${i === 0 ? 'card-glow' : ''}`}
                      style={{ aspectRatio: '3/4' }}
                    />
                  </div>
                  <div className="w-full">
                    <p className="text-white text-[10px] font-semibold truncate">{item.cards?.name}</p>
                    <p className="text-gray-500 text-[9px] truncate">{item.cards?.set_code} {item.cards?.number}</p>
                    <RarityBadge rarity={item.cards?.rarity} />
                    <div className={`mt-1 rounded-lg px-2 py-1 text-center text-xs font-bold ${
                      i === 0 ? 'bg-[#1a1200] text-[#EAB308] border border-[#EAB308]/30' :
                      'bg-[#0a1830] text-[#3B82F6] border border-[#3B82F6]/30'
                    }`}>
                      {brl(item.price)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Atualizar preços */}
        <div className="flex flex-col items-center gap-2">
          {!updating ? (
            <>
              <button
                onClick={handleUpdatePrices}
                className="flex items-center gap-2 bg-[#0f1929] border border-[#1e2d45] text-gray-300 text-sm font-medium px-5 py-3 rounded-xl active:bg-[#162035]"
              >
                <RefreshIcon />
                Atualizar Preços
              </button>
              {lastUpdate && (
                <p className="text-gray-600 text-xs">
                  Atualizado: {formatDate(lastUpdate)} às {new Date(lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </>
          ) : (
            <div className="w-full bg-[#0f1929] border border-[#1e2d45] rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-300">
                Atualizando <span className="text-white font-semibold">{updateProgress.name}</span>...
              </p>
              <div className="bg-[#1e2d45] rounded-full h-2">
                <div className="progress-bar h-2 rounded-full" style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }} />
              </div>
              <p className="text-xs text-gray-500 text-center">({updateProgress.current}/{updateProgress.total})</p>
            </div>
          )}
        </div>

        {/* Relatório */}
        {updateReport && (
          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-white">Resultado da Atualização</p>
              <button onClick={() => setUpdateReport(null)} className="text-gray-500 text-xl">×</button>
            </div>
            {updateReport.up.length > 0 && (
              <div>
                <p className="text-[#4ADE80] text-xs font-semibold mb-1">↑ Valorizaram</p>
                {updateReport.up.map((c, i) => (
                  <p key={i} className="text-sm text-gray-300">{c.name} <span className="text-[#4ADE80]">+{brl(c.diff)}</span></p>
                ))}
              </div>
            )}
            {updateReport.down.length > 0 && (
              <div>
                <p className="text-red-400 text-xs font-semibold mb-1">↓ Desvalorizaram</p>
                {updateReport.down.map((c, i) => (
                  <p key={i} className="text-sm text-gray-300">{c.name} <span className="text-red-400">{brl(c.diff)}</span></p>
                ))}
              </div>
            )}
            {updateReport.same.length > 0 && (
              <p className="text-gray-500 text-xs">{updateReport.same.length} carta(s) sem variação</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({ label, value, sub, color, icon }) {
  return (
    <div className="bg-[#162035] rounded-xl p-2.5 flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        {icon && <span className={`text-[10px] ${color}`}>{icon}</span>}
        <p className={`text-lg font-black leading-none ${color}`}>{value}</p>
      </div>
      {sub && <p className="text-gray-500 text-[9px]">{sub}</p>}
      <p className="text-gray-500 text-[8px] font-semibold tracking-wider">{label}</p>
    </div>
  )
}

function RarityBadge({ rarity }) {
  if (!rarity) return null
  const isUltra = rarity?.includes('Ultra') || rarity?.includes('Special') || rarity?.includes('Hyper')
  const isRare = rarity?.includes('Rare')
  if (isUltra) return <p className="text-[#A855F7] text-[8px] font-semibold mt-0.5">★★ ULTRA RARA</p>
  if (isRare) return <p className="text-[#EAB308] text-[8px] font-semibold mt-0.5">★ RARA</p>
  return <p className="text-gray-500 text-[8px] mt-0.5">{rarity}</p>
}

function PokeBallSVG() {
  return (
    <svg viewBox="0 0 48 48" className="w-8 h-8">
      <circle cx="24" cy="24" r="22" fill="none" stroke="#3B82F6" strokeWidth="2" />
      <path d="M2 24 A22 22 0 0 1 46 24 Z" fill="#3B82F6" />
      <path d="M2 24 A22 22 0 0 0 46 24 Z" fill="#0f1929" />
      <rect x="2" y="22" width="44" height="4" fill="#1e2d45" />
      <circle cx="24" cy="24" r="7" fill="#1e2d45" />
      <circle cx="24" cy="24" r="4" fill="#3B82F6" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  )
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
