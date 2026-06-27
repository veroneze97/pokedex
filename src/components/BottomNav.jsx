import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
)

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="flex items-center justify-around bg-[#111] border-t border-[#333] safe-bottom py-2">
      <button
        onClick={() => navigate('/')}
        className={`flex flex-col items-center gap-1 px-6 py-1 ${pathname === '/' ? 'text-pokered' : 'text-gray-500'}`}
      >
        <HomeIcon />
        <span className="text-[10px] font-medium">Início</span>
      </button>

      <button
        onClick={() => navigate('/camera')}
        className="flex items-center justify-center w-16 h-16 bg-pokered rounded-full shadow-lg -mt-8 btn-pulse"
      >
        <CameraIcon />
      </button>

      <button
        onClick={() => navigate('/pokedex')}
        className={`flex flex-col items-center gap-1 px-6 py-1 ${pathname === '/pokedex' ? 'text-pokered' : 'text-gray-500'}`}
      >
        <GridIcon />
        <span className="text-[10px] font-medium">PokéDex</span>
      </button>
    </nav>
  )
}
