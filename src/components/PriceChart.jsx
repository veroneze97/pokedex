import React, { useState } from 'react'
import { formatDate, brl } from '../utils/format'

const GOLD = '#F5A623'

export default function PriceChart({ history }) {
  const [activeIdx, setActiveIdx] = useState(null)

  if (!history || history.length < 2) {
    return (
      <p className="text-[#8E8E93] text-sm text-center py-6">
        Histórico insuficiente para exibir gráfico
      </p>
    )
  }

  const prices = history.map(h => h.price_brl)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const W = 300, H = 72, P = 3
  const pts = history.map((h, i) => {
    const x = P + (i / (history.length - 1)) * (W - P * 2)
    const y = H - P - ((h.price_brl - min) / range) * (H - P * 2)
    return { x, y }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const lastPt = pts[pts.length - 1]

  function pointerToIndex(clientX, svgEl) {
    const rect = svgEl.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * W
    let closest = 0
    let closestDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - relX)
      if (d < closestDist) { closestDist = d; closest = i }
    })
    return closest
  }

  function handleMove(e) {
    setActiveIdx(pointerToIndex(e.clientX, e.currentTarget))
  }

  const activePt = activeIdx != null ? pts[activeIdx] : null
  const activeEntry = activeIdx != null ? history[activeIdx] : null

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-[#8E8E93] mb-1">
        <span>Mín. {brl(min)}</span>
        <span>Máx. {brl(max)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setActiveIdx(null)}
        onPointerUp={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${P},${H - P} ${polyline} ${W - P},${H - P}`}
          fill="url(#chart-fill)"
          className="spark-fill"
        />
        <polyline
          points={polyline}
          pathLength="1"
          className="spark-draw"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={GOLD} className="spark-fill" />
        {activePt && (
          <g>
            <line x1={activePt.x} y1={0} x2={activePt.x} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <circle cx={activePt.x} cy={activePt.y} r="4" fill="#000000" stroke={GOLD} strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-[#8E8E93]">
          {formatDate((activeEntry || history[history.length - 1]).date_recorded)}
        </span>
        <span className="text-[#F5A623]" style={{ fontWeight: 600 }}>
          {brl((activeEntry || history[history.length - 1]).price_brl)}
        </span>
      </div>
    </div>
  )
}
