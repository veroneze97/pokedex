import React from 'react'
import { useNavigate } from 'react-router-dom'
import { brl } from '../utils/format'
import { getTypeGlow } from '../utils/typeColors'

function CardTile({ card, owned, quantity, price, index = 0 }) {
  const navigate = useNavigate()
  const delay = Math.min(index * 28, 560)
  const glow = owned ? getTypeGlow(card.type) : null

  return (
    <button
      onClick={() => navigate(`/card/${card.id}`, { viewTransition: true })}
      className="pressable relative flex flex-col text-left card-enter"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`relative w-full aspect-[2.5/3.5] rounded-xl ${!owned ? 'border border-white/[0.06]' : ''}`}
        style={glow || undefined}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#101014]">
          <img
            src={card.images?.small || card.image_url}
            alt={card.name}
            className={`w-full h-full object-cover ${!owned ? 'silhouette' : ''}`}
            loading="lazy"
          />
          {owned && <div className="holo-sheen" />}
        </div>
        {owned && quantity > 1 && (
          <span className="absolute top-2 right-2 bg-[#F4F4F6] text-[#000000] text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
            {quantity}×
          </span>
        )}
      </div>

      <div className="pt-2 pb-1 px-0.5">
        <p className="text-[#F4F4F6] text-[12px] font-semibold leading-snug truncate">
          {card.name}
        </p>
        {owned && price != null && price > 0 ? (
          <p className="text-[#F5A623] text-[11px] font-bold tabular-nums mt-0.5">{brl(price)}</p>
        ) : (
          <p className="text-[#8E8E93] text-[10px] tabular-nums mt-0.5">
            #{String(card.number || '').padStart(3, '0')}
          </p>
        )}
      </div>
    </button>
  )
}

export default React.memo(CardTile)
