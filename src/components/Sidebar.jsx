// src/components/Sidebar.jsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tabs } from './navTabs'

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <aside
      className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full px-4 py-8 gap-1"
      style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3 px-2 mb-8">
        <img src="/desktop/sidebar-brand.png" alt="" className="w-9 h-9" />
        <span className="text-[#F4F4F6] text-[15px] font-bold tracking-tight">PokéDex</span>
      </div>

      {tabs.map(({ path, label, Icon }) => {
        const active = pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path, { viewTransition: true })}
            className={`pressable flex items-center gap-3 px-4 rounded-xl text-[14px] font-medium transition-colors ${
              active ? 'text-[#000000]' : 'text-[#8E8E93] hover:text-[#F4F4F6]'
            }`}
            style={{
              minHeight: 46,
              background: active ? 'linear-gradient(135deg, #F5A623, #E8871E)' : 'transparent',
            }}
          >
            <Icon heavy={active} />
            {label}
          </button>
        )
      })}
    </aside>
  )
}
