import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getPriceHistory } from '../services/supabase'
import { brl, rarityLabel, rarityColor, formatDate, diffLabel } from '../utils/format'
import PriceChart from '../components/PriceChart'
import PokeballLoader from '../components/PokeballLoader'

export default function CardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [colItem, setColItem] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCard()
  }, [id])

  async function loadCard() {
    try {
      const { data: cardData } = await supabase.from('cards').select('*').eq('id', id).single()
      setCard(cardData)

      const { data: colData } = await supabase
        .from('collection')
        .select('*')
        .eq('card_id', id)
        .single()
      setColItem(colData)

      if (colData) {
        const hist = await getPriceHistory(id)
        setPriceHistory(hist)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><PokeballLoader /></div>
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-gray-400">Carta não encontrada</p>
        <button onClick={() => navigate(-1)} className="text-pokered text-sm">Voltar</button>
      </div>
    )
  }

  const latestPrice = priceHistory[priceHistory.length - 1]?.price_brl || 0
  const firstPrice = priceHistory[0]?.price_brl || 0
  const diff = diffLabel(latestPrice, firstPrice)

  return (
    <div className="pb-24">
      {/* Back button */}
      <div className="safe-top p-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-400 text-sm">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          Voltar
        </button>
      </div>

      {/* Card image */}
      <div className="flex justify-center px-8 mb-5">
        <img
          src={card.image_url}
          alt={card.name}
          className="w-64 rounded-2xl shadow-2xl shadow-black/60"
        />
      </div>

      <div className="px-4 space-y-4">
        {/* Info básica */}
        <div>
          <h1 className="text-2xl font-bold text-white">{card.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-400 text-sm font-mono">
              #{String(card.number).padStart(3, '0')} / {card.set_code}
            </span>
            <span className={`text-sm font-medium ${rarityColor[card.rarity] || 'text-gray-400'}`}>
              {rarityLabel[card.rarity] || card.rarity}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Condição" value="NM" />
          <StatCard label="Quantidade" value={colItem ? `${colItem.quantity}x` : '—'} />
          <StatCard label="Adicionado" value={colItem ? formatDate(colItem.date_added) : '—'} />
        </div>

        {/* Preço */}
        {colItem && (
          <div className="bg-[#2a2a2a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Preço atual (NM)</p>
            <p className="text-3xl font-extrabold text-white">{brl(latestPrice)}</p>
            {diff && (
              <p className={`text-sm mt-1 font-medium ${diff.positive ? 'text-green-400' : 'text-red-400'}`}>
                {diff.positive ? '↑' : '↓'} {diff.label} desde que você adicionou
              </p>
            )}
          </div>
        )}

        {/* Gráfico */}
        {colItem && (
          <div className="bg-[#2a2a2a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-3">Histórico de preço</p>
            <PriceChart history={priceHistory} />
          </div>
        )}

        {/* Carta não possuída */}
        {!colItem && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-gray-400 text-sm">Você ainda não possui esta carta</p>
            <button
              onClick={() => navigate('/camera')}
              className="bg-pokered text-white font-semibold px-6 py-3 rounded-xl active:bg-pokered-dark"
            >
              Adicionar via Câmera
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-[#2a2a2a] rounded-xl p-3 flex flex-col items-center gap-1">
      <p className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  )
}
