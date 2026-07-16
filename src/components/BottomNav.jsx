import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tabs } from './navTabs'

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
