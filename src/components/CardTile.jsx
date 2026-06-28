import React from 'react'
import { useNavigate } from 'react-router-dom'
import { brl } from '../utils/format'

export default function CardTile({ card, owned, quantity, price, index = 0 }) {
  const navigate = useNavigate()
  const delay = Math.min(index * 28, 560)

  return (
    <button
      onClick={() => navigate(`/card/${card.id}`)}
      className="relative flex flex-col text-left card-enter"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-[#16161A] border border-[#24242A]">
        <img
          src={card.images?.small || card.image_url}
          alt={card.name}
          className={`w-full h-full object-cover ${!owned ? 'silhouette' : ''}`}
          loading="lazy"
        />
        {owned && quantity > 1 && (
          <span className="absolute top-2 right-2 bg-[#F4F4F6] text-[#0A0A0C] text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
            {quantity}×
          </span>
        )}
      </div>

      <div className="pt-2 pb-1 px-0.5">
        <p className="text-[#F4F4F6] text-[12px] font-semibold leading-snug truncate">
          {card.name}
        </p>
        {owned && price != null && price > 0 ? (
          <p className="text-[#00E676] text-[11px] font-bold tabular-nums mt-0.5">{brl(price)}</p>
        ) : (
          <p className="text-[#8E8E93] text-[10px] tabular-nums mt-0.5">
            #{String(card.number || '').padStart(3, '0')}
          </p>
        )}
      </div>
    </button>
  )
}
