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
    <div className="flex flex-col h-full max-w-md mx-auto relative overflow-hidden">
      <div className="flex-1 overflow-y-auto scroll-hide">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pokedex" element={<Pokedex />} />
          <Route path="/card/:id" element={<CardDetail />} />
          <Route path="/camera" element={<Camera />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
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
