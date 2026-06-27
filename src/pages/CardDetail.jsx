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
    return (
      <div className="flex items-center justify-center h-full bg-[#080e1c]">
        <PokeballLoader />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#080e1c] gap-3">
        <p className="text-gray-400">Carta não encontrada</p>
        <button onClick={() => navigate(-1)} className="text-[#3B82F6] text-sm">Voltar</button>
      </div>
    )
  }

  const latestPrice = priceHistory[priceHistory.length - 1]?.price_brl || 0
  const firstPrice = priceHistory[0]?.price_brl || 0
  const diff = diffLabel(latestPrice, firstPrice)
  const isUltra = card.rarity?.includes('Ultra') || card.rarity?.includes('Special') || card.rarity?.includes('Hyper')

  return (
    <div className="min-h-full bg-[#080e1c] pb-28">
      {/* Header */}
      <div className="safe-top flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center bg-[#0f1929] border border-[#1e2d45] rounded-full text-gray-400"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-base">Detalhes da Carta</h1>
        <button className="w-9 h-9 flex items-center justify-center bg-[#0f1929] border border-[#1e2d45] rounded-full text-gray-400">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      {/* Card image with glow */}
      <div className="flex justify-center px-8 py-4">
        <div className={`relative rounded-2xl ${isUltra ? 'card-glow' : ''}`}
          style={isUltra ? { boxShadow: '0 0 30px rgba(234,179,8,0.5), 0 0 60px rgba(234,179,8,0.2)' } : {}}>
          <img
            src={card.image_url}
            alt={card.name}
            className="w-60 rounded-2xl shadow-2xl"
          />
          {isUltra && (
            <div className="absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, transparent 50%, rgba(234,179,8,0.05) 100%)', pointerEvents: 'none' }} />
          )}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Preço */}
        <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[#94A3B8] text-xs font-medium">Preço Atual (BRL)</p>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-gray-600">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
              </div>
              <p className="text-3xl font-black text-[#4ADE80]">{brl(latestPrice)}</p>
            </div>
            {diff && (
              <div className="flex flex-col items-end gap-1">
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${diff.positive ? 'bg-[#166534]/40 border border-[#166534]/60' : 'bg-red-900/40 border border-red-800/60'}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 ${diff.positive ? 'text-[#4ADE80]' : 'text-red-400'}`}>
                    <path d={diff.positive ? "M7 14l5-5 5 5z" : "M7 10l5 5 5-5z"} />
                  </svg>
                  <span className={`text-xs font-bold ${diff.positive ? 'text-[#4ADE80]' : 'text-red-400'}`}>{diff.label}</span>
                </div>
                <p className="text-gray-600 text-[10px]">últimos 7 dias</p>
                {/* Mini sparkline */}
                <svg viewBox="0 0 60 20" className="w-16 h-5">
                  <polyline points="0,16 10,14 20,15 30,10 40,12 50,6 60,4" fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Raridade + Conservação */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[#94A3B8] text-xs font-medium">Raridade</p>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-gray-600"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1a1200] border-2 border-[#EAB308] flex items-center justify-center">
                <span className="text-[#EAB308] text-sm">★</span>
              </div>
              <p className={`font-bold text-sm ${isUltra ? 'text-[#A855F7]' : 'text-[#EAB308]'}`}>
                {rarityLabel[card.rarity] || card.rarity || 'Normal'}
              </p>
            </div>
          </div>

          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[#94A3B8] text-xs font-medium">Estado de Conservação</p>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-gray-600"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-[#3B82F6] flex items-center justify-center">
                <span className="text-white text-xs font-black">NM</span>
              </div>
              <div>
                <p className="text-[#3B82F6] font-bold text-sm">Near Mint</p>
                <p className="text-gray-500 text-[10px]">Excelente estado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes */}
        <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl divide-y divide-[#1e2d45]">
          <DetailRow icon="📅" label="Lançamento" value={card.release_date ? formatDate(card.release_date) : '—'} />
          <DetailRow icon="🏷️" label="Coleção" value={card.set_name || card.set_code || '—'} />
          <DetailRow icon="🖼️" label="Número da Carta" value={card.number ? `${card.number}/${card.set_total || '?'}` : '—'} />
          <DetailRow icon="🎨" label="Ilustrador" value={card.illustrator || '—'} />
        </div>

        {/* Gráfico */}
        {colItem && priceHistory.length > 1 && (
          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
            <p className="text-[#94A3B8] text-xs font-medium mb-3">Histórico de Preço</p>
            <PriceChart history={priceHistory} />
          </div>
        )}

        {/* Info de coleção */}
        {colItem && (
          <div className="bg-[#0f1929] border border-[#1e2d45] rounded-2xl p-4">
            <div className="flex justify-around">
              <div className="flex flex-col items-center gap-1">
                <p className="text-white font-bold text-lg">{colItem.quantity}x</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wide">Quantidade</p>
              </div>
              <div className="w-px bg-[#1e2d45]" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-white font-bold text-lg">{formatDate(colItem.date_added)}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wide">Adicionado</p>
              </div>
            </div>
          </div>
        )}

        {/* Carta não possuída */}
        {!colItem && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-gray-400 text-sm">Você ainda não possui esta carta</p>
            <button
              onClick={() => navigate('/camera')}
              className="bg-[#3B82F6] text-white font-semibold px-6 py-3 rounded-xl active:bg-[#2563EB]"
            >
              Adicionar via Câmera
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className="text-[#94A3B8] text-sm">{label}</p>
      </div>
      <p className="text-white text-sm font-medium text-right max-w-[55%] truncate">{value}</p>
    </div>
  )
}
