import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { identifyCard } from '../services/vision'
import { searchCard } from '../services/tcgApi'
import { fetchPrice } from '../services/pricing'
import { addCardToCollection, savePriceApi } from '../services/api'
import { brl, rarityLabel } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'

const S = { PREVIEW: 'preview', PROCESSING: 'processing', CONFIRM: 'confirm', ERROR: 'error' }

export default function Camera() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [state, setState] = useState(S.PREVIEW)
  const [capturedImage, setCapturedImage] = useState(null)
  const [identified, setIdentified] = useState(null)
  const [tcgCard, setTcgCard] = useState(null)
  const [price, setPrice] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { name } shown briefly over the viewfinder

  const reset = useCallback(() => {
    setState(S.PREVIEW)
    setCapturedImage(null)
    setIdentified(null)
    setTcgCard(null)
    setPrice(null)
    setErrorMsg('')
    setSaving(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleCapture = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setCapturedImage(ev.target.result)
      setState(S.PROCESSING)
      await processImage(base64)
    }
    reader.readAsDataURL(file)
  }, [])

  async function processImage(base64) {
    try {
      const result = await identifyCard(base64)

      if (!result.isValidPTBR) {
        setErrorMsg('Essa carta parece ser uma impressão internacional. Este app é exclusivo para cartas PT-BR.')
        setState(S.ERROR)
        return
      }

      const [tcg, priceData] = await Promise.allSettled([
        searchCard(result.number, result.setCode),
        fetchPrice(result.name, result.setCode),
      ])

      setIdentified(result)
      setTcgCard(tcg.status === 'fulfilled' ? tcg.value : null)
      setPrice(priceData.status === 'fulfilled' ? priceData.value : null)
      setState(S.CONFIRM)
    } catch (e) {
      setErrorMsg('Não consegui identificar essa carta. Tente novamente com melhor iluminação e a carta centralizada na moldura.')
      setState(S.ERROR)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const number = identified.number.split('/')[0].padStart(3, '0')
      const result = await addCardToCollection({
        number,
        setCode: identified.setCode,
        name: identified.name,
        rarity: tcgCard?.rarity || identified.rarity,
        imageUrl: tcgCard?.images?.large || tcgCard?.images?.small || '',
      })

      if (price?.price && result.cardId) {
        savePriceApi(result.cardId, price.price, price.source).catch(() => {})
      }

      // Mostrar toast e voltar pra câmera automaticamente
      const cardName = identified.name
      reset()
      setToast({ name: cardName })
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setSaving(false)
      setErrorMsg(e.message || 'Erro ao salvar carta. Tente novamente.')
      setState(S.ERROR)
    }
  }

  // ── VIEWFINDER (tela da câmera) ───────────────────────────────────────────
  const showViewfinder = state === S.PREVIEW

  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-black">

      {/* Toast de sucesso flutuante */}
      {toast && (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center gap-3 bg-green-600/90 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-xl animate-[pop_0.3s_ease-out]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">{toast.name} adicionada!</p>
            <p className="text-green-200 text-xs">Pode fotografar a próxima carta</p>
          </div>
        </div>
      )}

      {/* Botão voltar */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-12 left-4 z-10 text-white bg-black/50 p-2 rounded-full"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* ── PREVIEW / câmera ── */}
      {showViewfinder && (
        <>
          <div className="relative w-72 h-96 border-2 border-white/30 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="text-center px-6">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 mx-auto mb-3 text-gray-700">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
              </svg>
              <p className="text-sm text-gray-500">Posicione a carta dentro da moldura</p>
            </div>
            {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((cls, i) => (
              <div key={i} className={`absolute ${cls} border-red-500 w-6 h-6 rounded-sm`} />
            ))}
          </div>
          <p className="text-gray-400 text-sm mt-6 mb-8">Centralise a carta e tire a foto</p>
          <label className="w-20 h-20 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-xl active:scale-95 transition-transform">
            <div className="w-16 h-16 bg-white rounded-full border-4 border-gray-300" />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
          </label>
        </>
      )}

      {/* ── PROCESSING ── */}
      {state === S.PROCESSING && (
        <div className="flex flex-col items-center gap-6">
          {capturedImage && <img src={capturedImage} alt="" className="w-48 rounded-xl opacity-30" />}
          <PokeballLoader size={64} text="Identificando carta..." />
        </div>
      )}

      {/* ── CONFIRM ── */}
      {state === S.CONFIRM && (
        <div className="flex flex-col w-full h-full bg-[#1a1a1a]">
          <div className="safe-top px-4 pt-14 pb-2 flex items-center justify-between">
            <button onClick={reset} className="text-gray-400 text-sm flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
              Tentar novamente
            </button>
            <p className="text-gray-400 text-xs">Confirmar carta</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
            <div className="flex justify-center pt-2">
              <img
                src={tcgCard?.images?.large || tcgCard?.images?.small || capturedImage}
                alt={identified?.name}
                className="w-48 rounded-2xl shadow-2xl"
              />
            </div>

            <div className="bg-[#2a2a2a] rounded-xl p-4 space-y-2.5">
              <Row label="Nome" value={identified?.name} bold />
              <Row label="Número" value={identified?.number} />
              <Row label="Raridade" value={rarityLabel[tcgCard?.rarity || identified?.rarity] || identified?.rarity} />
              <Row label="Condição" value="NM" />
              {price?.price && <Row label="Preço estimado" value={brl(price.price)} highlight />}
            </div>
          </div>

          <div className="px-4 pb-8 safe-bottom">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold text-base active:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <PokeballLoader size={20} />
                  Salvando...
                </>
              ) : (
                '✓ Adicionar à Coleção'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {state === S.ERROR && (
        <div className="flex flex-col items-center gap-6 px-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-red-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{errorMsg}</p>
          <button onClick={reset} className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm">
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, highlight }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-white' : highlight ? 'font-bold text-green-400' : 'text-gray-200'}`}>
        {value || '—'}
      </span>
    </div>
  )
}
