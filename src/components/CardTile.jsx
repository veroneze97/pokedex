import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function CardTile({ card, owned, quantity }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/card/${card.id}`)}
      className="relative flex flex-col items-center gap-1.5 card-pop"
      style={{ minHeight: 44 }}
    >
      <div className="relative w-full aspect-[2.5/3.5] rounded-lg overflow-hidden bg-[#16161A] border border-[#24242A]">
        <img
          src={card.images?.small || card.image_url}
          alt={card.name}
          className={`w-full h-full object-cover ${!owned ? 'silhouette opacity-25' : ''}`}
          loading="lazy"
        />
        {!owned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#24242A] text-lg font-bold">?</span>
          </div>
        )}
        {owned && quantity > 1 && (
          <span className="absolute top-1 right-1 bg-[#F4F4F6] text-[#0A0A0C] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {quantity}×
          </span>
        )}
      </div>
      <span className="text-[10px] text-[#8E8E93] font-medium tabular-nums">
        {String(card.number || '').padStart(3, '0')}
      </span>
    </button>
  )
}
