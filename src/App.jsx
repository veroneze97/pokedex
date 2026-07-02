import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Pokedex from './pages/Pokedex'
import CardDetail from './pages/CardDetail'
import Camera from './pages/Camera'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'

function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0A0A0C] gap-3 px-8">
      <div className="w-16 h-16 rounded-full bg-[#16161A] border border-[#24242A] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-[#8E8E93]">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>
      <p className="text-[#F4F4F6] text-[17px] font-bold">{title}</p>
      <p className="text-[#8E8E93] text-sm text-center">Em breve nesta versão do app</p>
    </div>
  )
}

function Inner() {
  const location = useLocation()
  const hideNav = location.pathname === '/camera'

  return (
    <div className="h-full max-w-md mx-auto relative overflow-hidden">
      <div className="h-full overflow-y-auto scroll-hide">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pokedex" element={<Pokedex />} />
          <Route path="/card/:id" element={<CardDetail />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/decks" element={<ComingSoon title="Decks" />} />
          <Route path="/market" element={<ComingSoon title="Mercado" />} />
        </Routes>
      </div>
      {!hideNav && (
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Inner />
    </ErrorBoundary>
  )
}
