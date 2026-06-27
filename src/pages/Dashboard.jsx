import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCollection, getLatestPrices } from '../services/supabase'
import { fetchPrice } from '../services/pricing'
import { savePrice } from '../services/supabase'
import { brl, formatDate } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

const TOTAL_CARDS = 94

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
      const [col, priceMap] = await Promise.all([getCollection(), getLatestPrices()])
      setCollection(col || [])
      setPrices(priceMap || {})
      if (priceMap && Object.values(priceMap).length > 0) {
        const latest = Object.values(priceMap).sort(
          (a, b) => new Date(b.date_recorded) - new Date(a.date_recorded)
        )[0]
        setLastUpdate(latest.date_recorded)
      }
    } catch (e) {
      console.warn('Supabase não configurado:', e.message)
      setCollection([])
      setPrices({})
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePrices() {
    if (!window.confirm(`Isso vai atualizar o preço de ${collection.length} carta(s) da sua coleção. Pode levar alguns minutos. Continuar?`)) return
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
              await savePrice(card.id, result.price, result.source)
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

  const mostValuable = collection
    .map(item => ({ ...item, price: prices[item.card_id]?.price_brl || 0 }))
    .sort((a, b) => b.price - a.price)[0]

  const recentCards = [...collection]
    .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
    .slice(0, 5)

  const uniqueOwned = new Set(collection.map(c => c.card_id)).size

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PokeballLoader text="Carregando coleção..." />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header */}
      <div className="safe-top pt-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8">
            <PokeBallSVG />
          </div>
          <h1 className="text-xl font-bold text-white">PokéDex PT-BR</h1>
        </div>
        <p className="text-gray-500 text-xs">Fogo Fantasmagórico</p>
      </div>

      {/* Valor total */}
      <div className="bg-gradient-to-br from-[#CC0000] to-[#880000] rounded-2xl p-5">
        <p className="text-red-200 text-xs font-medium uppercase tracking-wide mb-1">Valor da Coleção</p>
        <p className="text-4xl font-extrabold text-white">{brl(totalValue)}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-red-200 text-sm">{uniqueOwned} / {TOTAL_CARDS} cartas</span>
          <div className="flex-1 mx-3 bg-red-900 rounded-full h-2">
            <div className="progress-bar h-2 rounded-full" style={{ width: `${(uniqueOwned / TOTAL_CARDS) * 100}%` }} />
          </div>
          <span className="text-red-200 text-sm">{Math.round((uniqueOwned / TOTAL_CARDS) * 100)}%</span>
        </div>
      </div>

      {/* Carta mais valiosa */}
      {mostValuable && (
        <div
          className="flex items-center gap-3 bg-[#2a2a2a] rounded-xl p-3 cursor-pointer active:bg-[#333]"
          onClick={() => navigate(`/card/${mostValuable.card_id}`)}
        >
          <img
            src={mostValuable.cards?.image_url}
            alt={mostValuable.cards?.name}
            className="w-14 h-20 object-cover rounded-lg"
          />
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">Carta mais valiosa</p>
            <p className="font-semibold text-white text-sm">{mostValuable.cards?.name}</p>
            <p className="text-pokered font-bold text-lg mt-1">{brl(mostValuable.price)}</p>
          </div>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600"><path d="M10 6l6 6-6 6V6z" /></svg>
        </div>
      )}

      {/* Últimas adicionadas */}
      {recentCards.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-2">Adicionadas recentemente</p>
          <div className="flex gap-3 overflow-x-auto scroll-hide pb-1">
            {recentCards.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(`/card/${item.card_id}`)}
                className="flex-shrink-0 flex flex-col items-center gap-1"
              >
                <img
                  src={item.cards?.image_url}
                  alt={item.cards?.name}
                  className="w-16 h-22 rounded-lg object-cover"
                />
                <span className="text-[10px] text-gray-500">{formatDate(item.date_added)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botão atualizar preços */}
      <div className="flex flex-col items-center gap-2">
        {!updating ? (
          <>
            <button
              onClick={handleUpdatePrices}
              className="flex items-center gap-2 bg-[#2a2a2a] border border-[#444] text-white text-sm font-medium px-5 py-3 rounded-xl active:bg-[#333]"
            >
              <RefreshIcon />
              Atualizar Preços
            </button>
            {lastUpdate && (
              <p className="text-gray-600 text-xs">
                Última atualização: {formatDate(lastUpdate)} às {new Date(lastUpdate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </>
        ) : (
          <div className="w-full bg-[#2a2a2a] rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-300">
              Atualizando <span className="text-white font-semibold">{updateProgress.name}</span>...
            </p>
            <div className="bg-[#444] rounded-full h-2">
              <div
                className="progress-bar h-2 rounded-full"
                style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              ({updateProgress.current}/{updateProgress.total})
            </p>
          </div>
        )}
      </div>

      {/* Relatório de atualização */}
      {updateReport && (
        <div className="bg-[#2a2a2a] rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-white">Resultado da Atualização</p>
            <button onClick={() => setUpdateReport(null)} className="text-gray-500 text-xl">×</button>
          </div>
          {updateReport.up.length > 0 && (
            <div>
              <p className="text-green-400 text-xs font-semibold mb-1">↑ Valorizaram</p>
              {updateReport.up.map((c, i) => (
                <p key={i} className="text-sm text-gray-300">{c.name} <span className="text-green-400">+{brl(c.diff)}</span></p>
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
  )
}

function PokeBallSVG() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M4 24 A20 20 0 0 1 44 24 Z" fill="#CC0000" />
      <path d="M4 24 A20 20 0 0 0 44 24 Z" fill="#fff" />
      <rect x="4" y="22" width="40" height="4" fill="#222" />
      <circle cx="24" cy="24" r="7" fill="#222" />
      <circle cx="24" cy="24" r="4" fill="#fff" />
      <circle cx="24" cy="24" r="20" fill="none" stroke="#222" strokeWidth="2" />
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
