import React from 'react'

export default function OfflineBanner() {
  return (
    <div className="flex items-center gap-2.5 bg-[#16161A] border border-[#24242A] rounded-xl px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-[#FF3B30] flex-shrink-0" />
      <p className="text-[#8E8E93] text-[12px]">Sem conexão — mostrando dados salvos</p>
    </div>
  )
}
