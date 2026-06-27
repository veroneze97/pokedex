import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { identifyCard } from '../services/vision'
import { searchCard } from '../services/tcgApi'
import { fetchPrice } from '../services/pricing'
import { upsertCard, savePrice, supabase } from '../services/supabase'
import { brl, rarityLabel } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

const STATES = {
  PREVIEW: 'preview',
  PROCESSING: 'processing',
  CONFIRM: 'confirm',
  SUCCESS: 'success',
  ERROR: 'error',
}

export default function Camera() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [state, setState] = useState(STATES.PREVIEW)
  const [capturedImage, setCapturedImage] = useState(null)
  const [identified, setIdentified] = useState(null)
  const [tcgCard, setTcgCard] = useState(null)
  const [price, setPrice] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [flyCard, setFlyCard] = useState(false)

  const handleCapture = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      const dataUrl = ev.target.result
      setCapturedImage(dataUrl)
      setState(STATES.PROCESSING)
      await processImage(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  async function processImage(base64) {
    try {
      const result = await identifyCard(base64)

      if (!result.isValidPTBR) {
        setErrorMsg('Essa carta parece ser uma impressão internacional. Este app é exclusivo para cartas PT-BR.')
        setState(STATES.ERROR)
        return
      }

      // Busca dados na TCG API
      const tcg = await searchCard(result.number, result.setCode)

      // Busca preço
      let priceData = null
      try { priceData = await fetchPrice(result.name, result.setCode) } catch (_) {}

      setIdentified(result)
      setTcgCard(tcg)
      setPrice(priceData)
      setState(STATES.CONFIRM)
    } catch (e) {
      setErrorMsg('Não consegui identificar essa carta. Tente novamente com melhor iluminação e a carta centralizada na moldura.')
      setState(STATES.ERROR)
    }
  }

  async function handleConfirm() {
    try {
      // Find or create card in DB
      let { data: card } = await supabase
        .from('cards')
        .select('*')
        .eq('number', identified.number.split('/')[0].padStart(3, '0'))
        .eq('set_code', identified.setCode)
        .single()

      if (!card) {
        // Insert from TCG API data
        const { data: inserted } = await supabase.from('cards').insert({
          name: identified.name,
          number: identified.number.split('/')[0].padStart(3, '0'),
          set_code: identified.setCode,
          nationality: 'PT-BR',
          rarity: tcgCard?.rarity || identified.rarity,
          image_url: tcgCard?.images?.large || tcgCard?.images?.small || '',
        }).select().single()
        card = inserted
      }

      await upsertCard(card.id)

      if (price?.price) {
        await savePrice(card.id, price.price, price.source)
      }

      // Animação de sucesso
      setFlyCard(true)
      setTimeout(() => {
        setState(STATES.SUCCESS)
      }, 500)
    } catch (e) {
      console.error(e)
      setErrorMsg('Erro ao salvar carta. Tente novamente.')
      setState(STATES.ERROR)
    }
  }

  function reset() {
    setState(STATES.PREVIEW)
    setCapturedImage(null)
    setIdentified(null)
    setTcgCard(null)
    setPrice(null)
    setErrorMsg('')
    setFlyCard(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── PREVIEW / câmera ──────────────────────────────────────────────────────
  if (state === STATES.PREVIEW) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full bg-black">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-4 z-10 text-white bg-black/50 p-2 rounded-full"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
        </button>

        {/* Viewfinder */}
        <div className="relative w-72 h-96 border-2 border-white/30 rounded-2xl overflow-hidden flex items-center justify-center">
          <div className="text-gray-600 text-center px-6">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mx-auto mb-3 text-gray-700">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
            </svg>
            <p className="text-sm text-gray-500">Posicione a carta dentro da moldura</p>
          </div>
          {/* Corner guides */}
          {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((cls, i) => (
            <div key={i} className={`absolute ${cls} border-pokered w-6 h-6 rounded-sm`} />
          ))}
        </div>

        <p className="text-gray-400 text-sm mt-6 mb-8">Centralise a carta e tire a foto</p>

        {/* Capture button */}
        <label className="w-20 h-20 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-xl active:scale-95 transition-transform">
          <div className="w-16 h-16 bg-white rounded-full border-4 border-gray-300" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />
        </label>
      </div>
    )
  }

  // ── PROCESSING ────────────────────────────────────────────────────────────
  if (state === STATES.PROCESSING) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 bg-[#1a1a1a]">
        {capturedImage && (
          <img src={capturedImage} alt="" className="w-48 rounded-xl opacity-30" />
        )}
        <PokeballLoader size={64} text="Identificando carta..." />
      </div>
    )
  }

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (state === STATES.CONFIRM) {
    const imgSrc = tcgCard?.images?.large || tcgCard?.images?.small || capturedImage
    return (
      <div className="flex flex-col h-full bg-[#1a1a1a] pb-6">
        <div className="safe-top p-4">
          <p className="text-gray-400 text-sm">Confirmar carta</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          <div className="flex justify-center">
            <img
              src={imgSrc}
              alt={identified?.name}
              className={`w-52 rounded-2xl shadow-2xl ${flyCard ? 'card-fly' : ''}`}
            />
          </div>

          <div className="bg-[#2a2a2a] rounded-xl p-4 space-y-2">
            <Row label="Nome" value={identified?.name} bold />
            <Row label="Número" value={identified?.number} />
            <Row label="Set" value={identified?.setCode} />
            <Row label="Raridade" value={rarityLabel[tcgCard?.rarity || identified?.rarity] || identified?.rarity} />
            <Row label="Condição" value="NM" />
            {price?.price && <Row label="Preço atual" value={brl(price.price)} highlight />}
          </div>
        </div>

        <div className="px-4 flex gap-3 mt-4">
          <button
            onClick={reset}
            className="flex-1 py-3 rounded-xl border border-[#555] text-gray-300 font-medium text-sm active:bg-[#333]"
          >
            Tentar Novamente
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-pokered text-white font-semibold text-sm active:bg-pokered-dark"
          >
            Adicionar à Coleção
          </button>
        </div>
      </div>
    )
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (state === STATES.SUCCESS) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 bg-[#1a1a1a] px-6 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-green-400">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-white mb-1">Carta adicionada!</p>
          <p className="text-gray-400 text-sm">{identified?.name} foi adicionada à sua coleção</p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={reset}
            className="flex-1 py-3 rounded-xl bg-[#2a2a2a] text-gray-300 font-medium text-sm"
          >
            Fotografar outra
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-3 rounded-xl bg-pokered text-white font-semibold text-sm"
          >
            Ver coleção
          </button>
        </div>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-[#1a1a1a] px-6 text-center">
      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-red-400">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">{errorMsg}</p>
      <button
        onClick={reset}
        className="w-full py-3 rounded-xl bg-pokered text-white font-semibold text-sm"
      >
        Tentar Novamente
      </button>
      <button onClick={() => navigate(-1)} className="text-gray-500 text-sm">Voltar</button>
    </div>
  )
}

function Row({ label, value, bold, highlight }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-white' : highlight ? 'font-bold text-pokered' : 'text-gray-200'}`}>
        {value || '—'}
      </span>
    </div>
  )
}
