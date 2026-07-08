import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// Ícones outline (traço), estilo SF Symbols/Lucide.
// Ativo = traço mais pesado + cor clara; inativo = traço fino + cinza.
const strokeProps = heavy => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: heavy ? 2.4 : 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

const HomeIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
)

const CollectionIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m12 2 10 5-10 5L2 7z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
)

const CameraIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-6 h-6">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
)

const DecksIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="m3.29 7 8.71 5 8.71-5" />
    <path d="M12 22V12" />
  </svg>
)

const MarketIcon = ({ heavy }) => (
  <svg viewBox="0 0 24 24" {...strokeProps(heavy)} className="w-[22px] h-[22px]">
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
)

const tabs = [
  { path: '/',        label: 'Início',   Icon: HomeIcon },
  { path: '/pokedex', label: 'Coleção',  Icon: CollectionIcon },
  { path: '/camera',  label: 'Escanear', Icon: CameraIcon, center: true },
  { path: '/decks',   label: 'Decks',    Icon: DecksIcon },
  { path: '/market',  label: 'Mercado',  Icon: MarketIcon },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      className="flex items-end justify-around safe-bottom pt-2"
      style={{
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {tabs.map(({ path, label, Icon, center }) => {
        const active = pathname === path
        if (center) {
          return (
            <button
              key={path}
              onClick={() => navigate(path, { viewTransition: true })}
              className="pressable flex flex-col items-center gap-1 -mt-6"
              style={{ minWidth: 64, minHeight: 44 }}
            >
              <div
                className={`w-16 h-16 flex items-center justify-center rounded-full border-2 shadow-lg ${
                  active ? 'border-transparent text-black' : 'bg-[#101014] border-white/[0.06] text-[#8E8E93]'
                }`}
                style={active ? {
                  background: 'linear-gradient(135deg, #F5A623, #E8871E)',
                  boxShadow: '0 8px 20px rgba(245,166,35,0.35)',
                } : undefined}
              >
                <Icon heavy={active} />
              </div>
              <span className={`text-[9px] font-medium ${active ? 'text-[#F4F4F6]' : 'text-[#8E8E93]'}`}>
                {label}
              </span>
            </button>
          )
        }
        return (
          <button
            key={path}
            onClick={() => navigate(path, { viewTransition: true })}
            className={`pressable flex flex-col items-center gap-1 px-3 py-2 ${active ? 'text-[#F4F4F6]' : 'text-[#8E8E93]'}`}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon heavy={active} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
