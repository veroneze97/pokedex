import React from 'react'

export default function PokeballLoader({ size = 48, text }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="pokeball-spin"
      >
        {/* Top half - red */}
        <path d="M4 24 A20 20 0 0 1 44 24 Z" fill="#CC0000" />
        {/* Bottom half - white */}
        <path d="M4 24 A20 20 0 0 0 44 24 Z" fill="#fff" />
        {/* Middle line */}
        <rect x="4" y="22" width="40" height="4" fill="#222" />
        {/* Center circle outer */}
        <circle cx="24" cy="24" r="7" fill="#222" />
        {/* Center circle inner */}
        <circle cx="24" cy="24" r="4" fill="#fff" />
        {/* Outer ring */}
        <circle cx="24" cy="24" r="20" fill="none" stroke="#222" strokeWidth="2" />
      </svg>
      {text && <p className="text-gray-400 text-sm">{text}</p>}
    </div>
  )
}
