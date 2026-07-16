import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import PokeballLoader from './components/PokeballLoader'
import Sidebar from './components/Sidebar'

const Dashboard  = lazy(() => import('./pages/Dashboard'))
const Pokedex    = lazy(() => import('./pages/Pokedex'))
const CardDetail = lazy(() => import('./pages/CardDetail'))
const Camera     = lazy(() => import('./pages/Camera'))

function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#000000] gap-3 px-8">
      <div className="w-16 h-16 rounded-full bg-[#101014] border border-white/[0.06] flex items-center justify-center">
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
    <div className="h-full lg:flex relative">
      {/* Atmosfera: glow dourado sutil fixo atrás da sidebar, só no desktop */}
      <div
        className="hidden lg:block absolute pointer-events-none"
        style={{
          top: -200, left: -200, width: 500, height: 700,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(245,166,35,0.10), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <Sidebar />

      <div className="h-full max-w-md mx-auto lg:max-w-none lg:mx-0 lg:flex-1 relative overflow-hidden">
        <div className="h-full overflow-y-auto scroll-hide lg:px-12 lg:py-10">
          <div className="lg:max-w-6xl lg:mx-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full bg-[#000000]">
                <PokeballLoader text="Carregando..." />
              </div>
            }>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pokedex" element={<Pokedex />} />
                <Route path="/card/:id" element={<CardDetail />} />
                <Route path="/camera" element={<Camera />} />
                <Route path="/decks" element={<ComingSoon title="Decks" />} />
                <Route path="/market" element={<ComingSoon title="Mercado" />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>

      {!hideNav && (
        <div className="vt-nav lg:hidden absolute bottom-0 left-0 right-0 z-50 max-w-md mx-auto">
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
