import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Pokedex from './pages/Pokedex'
import CardDetail from './pages/CardDetail'
import Camera from './pages/Camera'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'

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
