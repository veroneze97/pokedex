import React from 'react'
import { formatDate, brl } from '../utils/format'

export default function PriceChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <p className="text-gray-500 text-sm text-center py-4">
        Histórico insuficiente para exibir gráfico
      </p>
    )
  }

  const prices = history.map(h => h.price_brl)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const W = 300, H = 100, PAD = 8
  const pts = history.map((h, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((h.price_brl - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const polyline = pts.join(' ')
  const lastPt = pts[pts.length - 1].split(',')

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CC0000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#CC0000" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon
          points={`${PAD},${H} ${polyline} ${W - PAD},${H}`}
          fill="url(#grad)"
        />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#CC0000" strokeWidth="2" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill="#CC0000" />
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatDate(history[0].date_recorded)}</span>
        <span>{brl(prices[prices.length - 1])}</span>
      </div>
    </div>
  )
}
