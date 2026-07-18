import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { identifyCard } from '../services/vision'
import { searchCard } from '../services/tcgApi'
import { fetchPrice } from '../services/pricing'
import { addCardToCollection, savePriceApi } from '../services/api'
import { invalidateDataCache } from '../services/dataCache'
import { brl, rarityLabel } from '../utils/format'
import PokeballLoader from '../components/PokeballLoader'
import { useIsDesktop } from '../hooks/useIsDesktop'

const S = { PREVIEW: 'preview', PROCESSING: 'processing', CONFIRM: 'confirm', ERROR: 'error' }

// Auto-captura: analisa frames em miniatura e dispara quando a cena
// estabiliza APÓS movimento (evita re-capturar a mesma carta parada).
const SAMPLE_SIZE = 32          // lado do canvas de análise (px)
const SAMPLE_INTERVAL = 180     // ms entre amostras
const MOTION_THRESHOLD = 7      // diff médio de luminância (0-255) que conta como movimento
const STABLE_DURATION = 900     // ms de estabilidade para disparar a captura
const STARTUP_GRACE = 600       // ms ignorados após a câmera ativar (autofoco)

export default function Camera() {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const scanIdRef = useRef(0)
  const analysisCanvasRef = useRef(null)   // canvas em memória — nunca o de captura
  const prevSampleRef = useRef(null)
  const motionSeenRef = useRef(false)
  const stableStartRef = useRef(null)
  const activatedAtRef = useRef(0)
  const [state, setState] = useState(S.PREVIEW)
  const [capturedImage, setCapturedImage] = useState(null)
  const [identified, setIdentified] = useState(null)
  const [tcgCard, setTcgCard] = useState(null)
  const [price, setPrice] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [camState, setCamState] = useState('idle') // idle | starting | active | error
  const [paidInput, setPaidInput] = useState('')
  const [lockProgress, setLockProgress] = useState(0) // 0..1 durante a estabilização
  const [flash, setFlash] = useState(false)

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
      // Reseta a detecção a cada (re)abertura: exige movimento antes de armar
      prevSampleRef.current = null
      motionSeenRef.current = false
      stableStartRef.current = null
      activatedAtRef.current = Date.now()
      setLockProgress(0)
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
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    setCapturedImage(dataUrl)
    setState(S.PROCESSING)
    processImage(base64)
  }, [])

  // ── Loop de auto-captura: movimento → estabilização → captura ────────────
  useEffect(() => {
    if (state !== S.PREVIEW || camState !== 'active') return

    const interval = setInterval(() => {
      const video = videoRef.current
      if (!video || !video.videoWidth) return
      if (Date.now() - activatedAtRef.current < STARTUP_GRACE) return

      if (!analysisCanvasRef.current) {
        analysisCanvasRef.current = document.createElement('canvas')
        analysisCanvasRef.current.width = SAMPLE_SIZE
        analysisCanvasRef.current.height = SAMPLE_SIZE
      }
      const ctx = analysisCanvasRef.current.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

      const sample = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE)
      for (let i = 0; i < sample.length; i++) {
        const o = i * 4
        sample[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
      }

      const prev = prevSampleRef.current
      prevSampleRef.current = sample
      if (!prev) return

      let diff = 0
      for (let i = 0; i < sample.length; i++) diff += Math.abs(sample[i] - prev[i])
      diff /= sample.length

      if (diff > MOTION_THRESHOLD) {
        // Cena mudou: arma a auto-captura e zera qualquer contagem em curso
        motionSeenRef.current = true
        stableStartRef.current = null
        setLockProgress(0)
        return
      }

      // Estável — só conta se já houve movimento desde a abertura da câmera
      if (!motionSeenRef.current) return
      if (!stableStartRef.current) stableStartRef.current = Date.now()
      const progress = Math.min(1, (Date.now() - stableStartRef.current) / STABLE_DURATION)
      setLockProgress(progress)
      if (progress >= 1) captureFrame()
    }, SAMPLE_INTERVAL)

    return () => clearInterval(interval)
  }, [state, camState, captureFrame])

  async function processImage(base64) {
    const scanId = ++scanIdRef.current
    try {
      const result = await identifyCard(base64)
      if (scanId !== scanIdRef.current) return // usuário já saiu dessa captura (reset/nova foto)

      if (!result.isValidPTBR) {
        setErrorMsg('Essa carta parece ser uma impressão internacional. Este app é exclusivo para cartas PT-BR.')
        setState(S.ERROR)
        return
      }

      // Avança para a confirmação assim que a identificação em si termina —
      // preço e imagem do catálogo (chamadas a APIs externas, mais lentas e
      // variáveis) são preenchidos depois, sem bloquear o "identificando".
      setIdentified(result)
      setState(S.CONFIRM)

      Promise.allSettled([
        searchCard(result.number, result.setCode),
        fetchPrice(result.number.split('/')[0].padStart(3, '0'), result.setCode),
      ]).then(([tcg, priceRes]) => {
        if (scanId !== scanIdRef.current) return // resultado de uma captura já abandonada
        setTcgCard(tcg.status === 'fulfilled' ? tcg.value : null)
        setPrice(priceRes.status === 'fulfilled' ? priceRes.value : null)
      })
    } catch {
      if (scanId !== scanIdRef.current) return
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
        purchasePrice: paidInput.trim() || undefined,
      })

      if (price?.price && result.cardId) {
        savePriceApi(result.cardId, price.price, price.source).catch(() => {})
      }

      invalidateDataCache()
      const cardName = identified.name
      reset()
      setToast({ name: cardName })
      setTimeout(() => setToast(null), 2500)
      // Scan em lote: reabre a câmera direto para a próxima carta,
      // sem passar pela tela "Ativar Câmera"
      setTimeout(() => startCamera(), 150)
    } catch (e) {
      setSaving(false)
      setErrorMsg(e.message || 'Erro ao salvar carta. Tente novamente.')
      setState(S.ERROR)
    }
  }

  function reset() {
    scanIdRef.current++ // invalida qualquer resultado tardio da captura anterior
    setState(S.PREVIEW)
    setCamState('idle')
    setCapturedImage(null)
    setIdentified(null)
    setTcgCard(null)
    setPrice(null)
    setErrorMsg('')
    setSaving(false)
    setPaidInput('')
    setLockProgress(0)
    setFlash(false)
  }

  const showVideo = state === S.PREVIEW && camState === 'active'

  if (isDesktop) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#000000] gap-6 px-8 text-center">
        <img
          src="/desktop/camera-desktop-blocked.png"
          alt=""
          className="w-full max-w-sm rounded-2xl"
        />
        <div>
          <p className="text-[#F4F4F6] text-[19px] font-bold mb-2">Escaneie pelo celular</p>
          <p className="text-[#8E8E93] text-sm leading-relaxed max-w-xs mx-auto">
            A captura de cartas por câmera é exclusiva da versão mobile/PWA instalada no seu celular.
          </p>
        </div>
        <button
          onClick={() => navigate('/', { viewTransition: true })}
          className="pressable h-12 px-6 rounded-xl bg-[#F4F4F6] text-[#000000] text-sm font-semibold"
        >
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full bg-[#000000] overflow-hidden">

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Flash de obturador na captura */}
      {flash && <div className="absolute inset-0 z-40 bg-white pointer-events-none" style={{ animation: 'camFlash 150ms ease-out forwards' }} />}
      <style>{'@keyframes camFlash { from { opacity: 0.85 } to { opacity: 0 } }'}</style>

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
        <div className="absolute top-16 left-5 right-5 z-50 flex items-center gap-3 bg-[#101014] border border-white/[0.06] px-4 py-3.5 rounded-2xl shadow-2xl card-pop">
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
        onClick={() => { stopCamera(); navigate('/', { viewTransition: true }) }}
        className="pressable absolute top-12 left-5 z-20 w-11 h-11 flex items-center justify-center rounded-xl bg-[#000000]/70 border border-white/[0.06] text-[#F4F4F6]"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', minWidth: 44, minHeight: 44 }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </button>

      {/* ── CÂMERA AO VIVO ── */}
      {state === S.PREVIEW && (
        <div className="flex flex-col flex-1">

          {camState === 'idle' && (
            <div className="flex flex-col flex-1 items-center justify-center gap-8 px-8">
              <div className="w-24 h-24 rounded-full bg-[#101014] border border-white/[0.06] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-11 h-11 text-[#8E8E93]">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[#F4F4F6] font-bold text-[17px] mb-2">Escanear Carta</p>
                <p className="text-[#8E8E93] text-sm leading-relaxed">Toque no botão para ativar a câmera e fotografar sua carta</p>
              </div>
              <button
                onClick={startCamera}
                className="pressable w-full h-14 rounded-xl bg-[#F4F4F6] text-[#000000] font-semibold text-sm active:opacity-80"
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
                className="pressable w-full h-12 rounded-xl bg-[#F4F4F6] text-[#000000] text-sm font-semibold active:opacity-80"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Overlay sobre o vídeo (moldura + botão captura) */}
          {camState === 'active' && (
            <>
              {/* Moldura guia — absolute sobre o vídeo. Cantos brancos →
                  dourados com glow crescente durante a estabilização */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="relative w-56 h-80">
                  {[
                    { pos: 'top-0 left-0', style: { borderTopWidth: 2.5, borderLeftWidth: 2.5, borderRadius: '6px 0 0 0' } },
                    { pos: 'top-0 right-0', style: { borderTopWidth: 2.5, borderRightWidth: 2.5, borderRadius: '0 6px 0 0' } },
                    { pos: 'bottom-0 left-0', style: { borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderRadius: '0 0 0 6px' } },
                    { pos: 'bottom-0 right-0', style: { borderBottomWidth: 2.5, borderRightWidth: 2.5, borderRadius: '0 0 6px 0' } },
                  ].map((c, i) => (
                    <div
                      key={i}
                      className={`absolute ${c.pos} w-8 h-8 transition-colors duration-200`}
                      style={{
                        ...c.style,
                        borderColor: lockProgress > 0 ? '#F5A623' : '#F4F4F6',
                        filter: lockProgress > 0 ? `drop-shadow(0 0 ${6 * lockProgress}px rgba(245,166,35,${0.8 * lockProgress}))` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className={`absolute bottom-28 left-0 right-0 text-center text-sm z-10 pointer-events-none transition-colors duration-200 ${
                lockProgress > 0 ? 'text-[#F5A623]' : 'text-[#F4F4F6]/70'
              }`}>
                {lockProgress > 0 ? 'Segure firme…' : 'Centralize a carta na moldura'}
              </p>

              {/* Botão captura na parte de baixo */}
              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-6 safe-bottom z-10"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
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
        <div className="flex flex-col flex-1 bg-[#000000]">
          <div className="safe-top px-5 pt-14 pb-2 flex items-center justify-between">
            <button
              onClick={reset}
              className="text-[#8E8E93] text-sm flex items-center gap-1.5"
              style={{ minHeight: 44 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
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
            <div className="bg-[#101014] border border-white/[0.06] rounded-xl overflow-hidden">
              <Row label="Nome" value={identified?.name} bold />
              <Row label="Número" value={identified?.number} />
              <Row label="Raridade" value={rarityLabel[tcgCard?.rarity || identified?.rarity] || identified?.rarity} />
              <Row label="Condição" value="NM" />
              <Row label="Preço estimado" value={price?.price ? brl(price.price) : '—'} highlight={!!price?.price} />
              <div className="flex items-center justify-between px-5" style={{ minHeight: 52 }}>
                <span className="text-[#8E8E93] text-sm">Preço pago (opcional)</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8E8E93] text-sm">R$</span>
                  <input
                    value={paidInput}
                    onChange={e => setPaidInput(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="bg-transparent text-right text-[#F4F4F6] text-sm font-medium w-20 outline-none placeholder-[#8E8E93]/50"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-8 safe-bottom">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="pressable w-full h-14 rounded-xl bg-[#F4F4F6] text-[#000000] font-semibold text-sm active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
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
            className="pressable w-full h-12 rounded-xl bg-[#F4F4F6] text-[#000000] font-semibold text-sm active:opacity-80"
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
      className={`flex items-center justify-between px-5 ${last ? '' : 'border-b border-white/[0.06]'}`}
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
