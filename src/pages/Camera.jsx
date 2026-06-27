import React, { useRef, useState, useCallback, useEffect } from 'react'
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
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [state, setState] = useState(S.PREVIEW)
  const [capturedImage, setCapturedImage] = useState(null)
  const [identified, setIdentified] = useState(null)
  const [tcgCard, setTcgCard] = useState(null)
  const [price, setPrice] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [camState, setCamState] = useState('idle') // idle | starting | active | error

  // Parar câmera ao sair do PREVIEW
  useEffect(() => {
    if (state !== S.PREVIEW) stopCamera()
  }, [state])

  async function startCamera() {
    setCamState('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('not supported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamState('active')
    } catch (e) {
      console.warn('Camera error:', e)
      setCamState('error')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const base64 = dataUrl.split(',')[1]
    stopCamera()
    setCapturedImage(dataUrl)
    setState(S.PROCESSING)
    processImage(base64)
  }, [])

  async function processImage(base64) {
    try {
      const result = await identifyCard(base64)

      if (!result.isValidPTBR) {
        setErrorMsg('Essa carta parece ser uma impressão internacional. Este app é exclusivo para cartas PT-BR.')
        setState(S.ERROR)
        return
      }

      const [tcg, priceRes] = await Promise.allSettled([
        searchCard(result.number, result.setCode),
        fetchPrice(result.name, result.setCode),
      ])

      setIdentified(result)
      setTcgCard(tcg.status === 'fulfilled' ? tcg.value : null)
      setPrice(priceRes.status === 'fulfilled' ? priceRes.value : null)
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

  function reset() {
    setState(S.PREVIEW)
    setCamState('idle')
    setCapturedImage(null)
    setIdentified(null)
    setTcgCard(null)
    setPrice(null)
    setErrorMsg('')
    setSaving(false)
  }

  return (
    <div className="relative flex flex-col h-full bg-black overflow-hidden">

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Toast de sucesso */}
      {toast && (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center gap-3 bg-green-600/95 text-white px-4 py-3 rounded-2xl shadow-xl card-pop">
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
      <button onClick={() => { stopCamera(); navigate('/') }} className="absolute top-12 left-4 z-20 text-white bg-black/50 p-2 rounded-full">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
      </button>

      {/* ── CÂMERA AO VIVO ── */}
      {state === S.PREVIEW && (
        <div className="flex flex-col flex-1">

          {/* Tela inicial: pedir para ativar câmera */}
          {camState === 'idle' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-8 px-8">
              <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-red-500">
                  <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg mb-2">Câmera</p>
                <p className="text-gray-400 text-sm">Toque no botão para ativar a câmera e fotografar sua carta</p>
              </div>
              <button
                onClick={startCamera}
                className="bg-red-600 text-white font-bold px-8 py-4 rounded-2xl text-base active:bg-red-700 w-full"
              >
                Ativar Câmera
              </button>
            </div>
          )}

          {/* Iniciando câmera */}
          {camState === 'starting' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-4">
              <PokeballLoader size={48} text="Ativando câmera..." />
            </div>
          )}

          {/* Erro de câmera */}
          {camState === 'error' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-4 px-8 text-center">
              <p className="text-gray-400 text-sm">Câmera não disponível. Verifique as permissões no browser e tente novamente.</p>
              <button onClick={startCamera} className="bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-semibold">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Feed ativo */}
          {camState === 'active' && (
            <>
              <div className="relative flex-1 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Moldura guia */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-80">
                    <div className="absolute top-0 left-0 w-8 h-8 border-red-500" style={{borderTopWidth:3,borderLeftWidth:3,borderRadius:'4px 0 0 0'}} />
                    <div className="absolute top-0 right-0 w-8 h-8 border-red-500" style={{borderTopWidth:3,borderRightWidth:3,borderRadius:'0 4px 0 0'}} />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-red-500" style={{borderBottomWidth:3,borderLeftWidth:3,borderRadius:'0 0 0 4px'}} />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-red-500" style={{borderBottomWidth:3,borderRightWidth:3,borderRadius:'0 0 4px 0'}} />
                  </div>
                </div>
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm">
                  Centralize a carta na moldura
                </p>
              </div>

              {/* Botão captura */}
              <div className="flex items-center justify-center bg-black py-6 safe-bottom">
                <button
                  onClick={captureFrame}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 rounded-full bg-white" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PROCESSANDO ── */}
      {state === S.PROCESSING && (
        <div className="flex flex-col flex-1 items-center justify-center gap-6">
          {capturedImage && <img src={capturedImage} alt="" className="w-48 rounded-xl opacity-40" />}
          <PokeballLoader size={64} text="Identificando carta..." />
        </div>
      )}

      {/* ── CONFIRMAR ── */}
      {state === S.CONFIRM && (
        <div className="flex flex-col flex-1 bg-[#1a1a1a]">
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
              {saving ? <><PokeballLoader size={20} /> Salvando...</> : '✓  Adicionar à Coleção'}
            </button>
          </div>
        </div>
      )}

      {/* ── ERRO ── */}
      {state === S.ERROR && (
        <div className="flex flex-col flex-1 items-center justify-center gap-6 px-6 text-center">
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
