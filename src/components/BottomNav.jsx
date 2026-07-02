import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
)

const CollectionIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z" />
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.5-10h-3.18L14 4h-4L7.68 5.5H4.5A2.5 2.5 0 0 0 2 8v11a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 19V8a2.5 2.5 0 0 0-2.5-2.5z" />
  </svg>
)

const DecksIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.5 1 13 1c-1.32 0-2.5.5-3.38 1.28C8.74 1.5 7.64 1 6.5 1 4.01 1 2 2.99 2 5.5c0 .49.1.94.18 1.38C1.44 7.28 1 8.09 1 9v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
  </svg>
)

const MarketIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h14v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.43 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
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
              onClick={() => navigate(path)}
              className="pressable flex flex-col items-center gap-1 -mt-6"
              style={{ minWidth: 64, minHeight: 44 }}
            >
              <div className={`w-16 h-16 flex items-center justify-center rounded-full border-2 shadow-lg ${
                active
                  ? 'bg-[#F4F4F6] border-[#F4F4F6] text-[#000000]'
                  : 'bg-[#101014] border-white/[0.06] text-[#8E8E93]'
              }`}>
                <Icon />
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
            onClick={() => navigate(path)}
            className={`pressable flex flex-col items-center gap-1 px-3 py-2 ${active ? 'text-[#F4F4F6]' : 'text-[#8E8E93]'}`}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
