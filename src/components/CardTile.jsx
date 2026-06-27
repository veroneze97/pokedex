import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function CardTile({ card, owned, quantity }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/card/${card.id}`)}
      className="relative flex flex-col items-center gap-1 card-pop"
    >
      <div className="relative w-full aspect-[2.5/3.5] rounded-lg overflow-hidden bg-[#2a2a2a]">
        <img
          src={card.images?.small || card.image_url}
          alt={card.name}
          className={`w-full h-full object-cover ${!owned ? 'silhouette' : ''}`}
          loading="lazy"
        />
        {!owned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-600 text-2xl font-bold">?</span>
          </div>
        )}
        {owned && quantity > 1 && (
          <span className="absolute top-1 right-1 bg-pokered text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {quantity}x
          </span>
        )}
      </div>
      <span className="text-[10px] text-gray-400 font-mono">
        {String(card.number || '').padStart(3, '0')}
      </span>
    </button>
  )
}
