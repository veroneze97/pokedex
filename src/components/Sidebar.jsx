// src/components/Sidebar.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { tabs } from './navTabs'
import { getCachedData } from '../services/dataCache'

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [setsList, setSetsList] = useState([])
  const onPokedex = pathname === '/pokedex'
  const [expanded, setExpanded] = useState(onPokedex)

  // Abre o submenu automaticamente ao chegar em /pokedex (ex: link direto,
  // botão "Ver todas" do Dashboard) — sem precisar clicar em "Coleção" de novo
  useEffect(() => {
    if (onPokedex) setExpanded(true)
  }, [onPokedex])

  useEffect(() => {
    getCachedData().then(data => setSetsList(data.sets || [])).catch(() => {})
  }, [])

  const activeSetCode = searchParams.get('set') || 'all'
  const setOptions = [{ code: 'all', label: 'Todos' }, ...setsList.map(s => ({ code: s.id, label: s.name }))]

  function goToSet(code) {
    navigate(code === 'all' ? '/pokedex' : `/pokedex?set=${encodeURIComponent(code)}`, { viewTransition: true })
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full px-4 py-8 gap-1 overflow-y-auto scroll-hide"
      style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3 px-2 mb-8">
        <img src="/desktop/sidebar-brand.png" alt="" className="w-9 h-9" />
        <span className="text-[#F4F4F6] text-[15px] font-bold tracking-tight">PokéDex</span>
      </div>

      {tabs.map(({ path, label, Icon }) => {
        const active = pathname === path
        const isCollection = path === '/pokedex'

        return (
          <React.Fragment key={path}>
            <button
              onClick={() => {
                if (isCollection && onPokedex) {
                  setExpanded(e => !e)
                } else {
                  navigate(path, { viewTransition: true })
                }
              }}
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

            {isCollection && expanded && (
              <div className="flex flex-col ml-4 pl-3 mb-1 gap-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                {setOptions.map(s => {
                  const setActive = onPokedex && activeSetCode === s.code
                  return (
                    <button
                      key={s.code}
                      onClick={() => goToSet(s.code)}
                      className={`pressable text-left px-3 rounded-lg text-[13px] truncate transition-colors ${
                        setActive ? 'text-[#F5A623] font-semibold' : 'text-[#8E8E93] hover:text-[#F4F4F6]'
                      }`}
                      style={{ minHeight: 34 }}
                      title={s.label}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </aside>
  )
}
