import React from 'react'

// Tipografia de dinheiro: "R$" menor e secundário, centavos reduzidos,
// tracking fechado — o padrão dos apps financeiros premium.
export default function Money({ value, size = 32, className = '' }) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
  const [intPart, cents] = formatted.split(',')

  return (
    <span
      className={`font-bold tabular-nums ${className}`}
      style={{ fontSize: size, letterSpacing: '-0.02em', lineHeight: 1 }}
    >
      <span
        className="font-semibold text-[#8E8E93]"
        style={{ fontSize: Math.round(size * 0.55), marginRight: Math.round(size * 0.08) }}
      >
        R$
      </span>
      {intPart}
      <span style={{ fontSize: Math.round(size * 0.68) }}>,{cents}</span>
    </span>
  )
}
