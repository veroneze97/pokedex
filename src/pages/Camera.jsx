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

      const video = videoRef.current
      if (!video) throw new Error('video element not mounted')

      video.srcObject = stream

      // readyState >= 1 means metadata already loaded (race condition safe)
      await new Promise(resolve => {
        if (video.readyState >= 1) {
          resolve()
        } else {
          video.onloadedmetadata = resolve
        }
      })

      await video.play()
      setCamState('active')
    } catch (e) {
      console.warn('Camera error:', e)
      setCamState('error')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const w = video.videoWidth
    const h = video.videoHeight

    if (!w || !h) {
      setErrorMsg('A câmera ainda está carregando. Aguarde um instante e tente novamente.')
      setState(S.ERROR)
      return
    }

    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(video, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]

    if (!base64 || base64.length < 1000) {
      setErrorMsg('Não consegui capturar a imagem. Verifique a iluminação e tente novamente.')
      setState(S.ERROR)
      return
    }

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
    } catch {
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

  const showVideo = state === S.PREVIEW && camState === 'active'

  return (
    <div className="relative flex flex-col h-full bg-[#0A0A0C] overflow-hidden">

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {/*
        Vídeo SEMPRE no DOM enquanto em PREVIEW para que videoRef.current
        não seja null quando startCamera() tentar anexar o srcObject.
        É ocultado com 'hidden' quando não ativo (display:none preserva a ref).
      */}
      {state === S.PREVIEW && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={showVideo ? 'absolute inset-0 w-full h-full object-cover' : 'hidden'}
        />
      )}

      {/* Toast de sucesso */}
      {toast && (
        <div className="absolute top-16 left-5 right-5 z-50 flex items-center gap-3 bg-[#16161A] border border-[#24242A] px-4 py-3.5 rounded-2xl shadow-2xl card-pop">
          <div className="w-9 h-9 rounded-full bg-[#00E67614] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#00E676]">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[#F4F4F6] font-semibold text-sm truncate">{toast.name} adicionada!</p>
            <p className="text-[#8E8E93] text-xs mt-0.5">Pode fotografar a próxima carta</p>
          </div>
        </div>
      )}

      {/* Botão voltar */}
      <button
        onClick={() => { stopCamera(); navigate('/') }}
        className="absolute top-12 left-5 z-20 w-11 h-11 flex items-center justify-center rounded-xl bg-[#0A0A0C]/70 border border-[#24242A] text-[#F4F4F6]"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', minWidth: 44, minHeight: 44 }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
      </button>

      {/* ── CÂMERA AO VIVO ── */}
      {state === S.PREVIEW && (
        <div className="flex flex-col flex-1">

          {camState === 'idle' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-8 px-8">
              <div className="w-24 h-24 rounded-full bg-[#16161A] border border-[#24242A] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-11 h-11 text-[#8E8E93]">
                  <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[#F4F4F6] font-bold text-[17px] mb-2">Escanear Carta</p>
                <p className="text-[#8E8E93] text-sm leading-relaxed">Toque no botão para ativar a câmera e fotografar sua carta</p>
              </div>
              <button
                onClick={startCamera}
                className="w-full h-14 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] font-semibold text-sm active:opacity-80"
              >
                Ativar Câmera
              </button>
            </div>
          )}

          {camState === 'starting' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-4">
              <PokeballLoader size={48} text="Ativando câmera..." />
            </div>
          )}

          {camState === 'error' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-6 px-8 text-center">
              <p className="text-[#8E8E93] text-sm leading-relaxed">Câmera não disponível. Verifique as permissões no browser e tente novamente.</p>
              <button
                onClick={startCamera}
                className="w-full h-12 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] text-sm font-semibold active:opacity-80"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Overlay sobre o vídeo (moldura + botão captura) */}
          {camState === 'active' && (
            <>
              {/* Moldura guia — absolute sobre o vídeo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="relative w-56 h-80">
                  <div className="absolute top-0 left-0 w-8 h-8 border-[#F4F4F6]" style={{borderTopWidth:2.5,borderLeftWidth:2.5,borderRadius:'6px 0 0 0'}} />
                  <div className="absolute top-0 right-0 w-8 h-8 border-[#F4F4F6]" style={{borderTopWidth:2.5,borderRightWidth:2.5,borderRadius:'0 6px 0 0'}} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-[#F4F4F6]" style={{borderBottomWidth:2.5,borderLeftWidth:2.5,borderRadius:'0 0 0 6px'}} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-[#F4F4F6]" style={{borderBottomWidth:2.5,borderRightWidth:2.5,borderRadius:'0 0 6px 0'}} />
                </div>
              </div>
              <p className="absolute bottom-28 left-0 right-0 text-center text-[#F4F4F6]/70 text-sm z-10 pointer-events-none">
                Centralize a carta na moldura
              </p>

              {/* Botão captura na parte de baixo */}
              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-6 safe-bottom z-10"
                style={{ background: 'linear-gradient(to top, rgba(10,10,12,0.85), transparent)' }}
              >
                <button
                  onClick={captureFrame}
                  className="w-20 h-20 rounded-full border-4 border-[#F4F4F6] flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 rounded-full bg-[#F4F4F6]" />
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
        <div className="flex flex-col flex-1 bg-[#0A0A0C]">
          <div className="safe-top px-5 pt-14 pb-2 flex items-center justify-between">
            <button
              onClick={reset}
              className="text-[#8E8E93] text-sm flex items-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
              Tentar novamente
            </button>
            <p className="text-[#8E8E93] text-[10px] font-medium uppercase tracking-widest">Confirmar carta</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 space-y-5 pb-4">
            <div className="flex justify-center pt-3">
              <img
                src={tcgCard?.images?.large || tcgCard?.images?.small || capturedImage}
                alt={identified?.name}
                className="w-48 rounded-xl"
                style={{ filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.85))' }}
              />
            </div>
            <div className="bg-[#16161A] border border-[#24242A] rounded-xl overflow-hidden">
              <Row label="Nome" value={identified?.name} bold />
              <Row label="Número" value={identified?.number} />
              <Row label="Raridade" value={rarityLabel[tcgCard?.rarity || identified?.rarity] || identified?.rarity} />
              <Row label="Condição" value="NM" />
              <Row label="Preço estimado" value={price?.price ? brl(price.price) : '—'} highlight={!!price?.price} last />
            </div>
          </div>

          <div className="px-5 pb-8 safe-bottom">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full h-14 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] font-semibold text-sm active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <><PokeballLoader size={20} /> Salvando...</> : 'Adicionar à Coleção'}
            </button>
          </div>
        </div>
      )}

      {/* ── ERRO ── */}
      {state === S.ERROR && (
        <div className="flex flex-col flex-1 items-center justify-center gap-6 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[#FF3B3014] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-[#FF3B30]">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <p className="text-[#8E8E93] text-sm leading-relaxed">{errorMsg}</p>
          <button
            onClick={reset}
            className="w-full h-12 rounded-xl bg-[#F4F4F6] text-[#0A0A0C] font-semibold text-sm active:opacity-80"
          >
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, highlight, last }) {
  return (
    <div
      className={`flex items-center justify-between px-5 ${last ? '' : 'border-b border-[#24242A]'}`}
      style={{ minHeight: 52 }}
    >
      <span className="text-[#8E8E93] text-sm">{label}</span>
      <span className={`text-sm text-right max-w-[60%] truncate ${
        bold ? 'font-bold text-[#F4F4F6]' : highlight ? 'font-bold text-[#00E676]' : 'font-medium text-[#F4F4F6]'
      }`}>
        {value || '—'}
      </span>
    </div>
  )
}
