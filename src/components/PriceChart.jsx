import React from 'react'
import { formatDate, brl } from '../utils/format'

export default function PriceChart({ history }) {
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
    return `${x},${y}`
  })

  const polyline = pts.join(' ')
  const lastPt  = pts[pts.length - 1].split(',')
  const positive = prices[prices.length - 1] >= prices[0]
  const color    = positive ? '#00E676' : '#FF3B30'

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${P},${H} ${polyline} ${W - P},${H}`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill={color} />
      </svg>
      <div className="flex justify-between text-[11px] mt-1">
        <span className="text-[#8E8E93]">{formatDate(history[0].date_recorded)}</span>
        <span className={positive ? 'text-[#00E676]' : 'text-[#FF3B30]'} style={{ fontWeight: 600 }}>
          {brl(prices[prices.length - 1])}
        </span>
      </div>
    </div>
  )
}
