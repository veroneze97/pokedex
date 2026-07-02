import React, { useEffect, useState } from 'react'

// Coluna de 0–9 que rola até o dígito alvo (transição CSS em .digit-stack).
// Monta em 0 e anima até o valor — decorativo: o estado final é garantido
// pela própria transição CSS, sem depender de rAF.
function DigitCol({ digit }) {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setPos(digit), 60)
    return () => clearTimeout(t)
  }, [digit])
  return (
    <span className="digit-col">
      <span className="digit-stack" style={{ transform: `translateY(-${pos}em)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <span key={n}>{n}</span>)}
      </span>
    </span>
  )
}

// Tipografia de dinheiro: "R$" menor e secundário, centavos reduzidos,
// tracking fechado — o padrão dos apps financeiros premium.
// `rolling` ativa os dígitos de odômetro (usar no KPI do Dashboard).
export default function Money({ value, size = 32, rolling = false, className = '' }) {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
  const [intPart, cents] = formatted.split(',')

  if (!rolling) {
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

  return (
    <span
      className={`font-bold tabular-nums ${className}`}
      style={{
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'flex-end',
      }}
    >
      <span
        className="font-semibold text-[#8E8E93]"
        style={{ fontSize: Math.round(size * 0.55), lineHeight: 1, marginRight: Math.round(size * 0.08) }}
      >
        R$
      </span>
      {intPart.split('').map((ch, i) =>
        /\d/.test(ch)
          // key inclui o comprimento: quando muda a qtde de dígitos (0 → 559),
          // as colunas remontam e rolam do zero até o alvo
          ? <DigitCol key={`i${intPart.length}-${i}`} digit={Number(ch)} />
          : <span key={`s${i}`} style={{ lineHeight: 1 }}>{ch}</span>
      )}
      <span
        style={{
          fontSize: Math.round(size * 0.68),
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'flex-end',
        }}
      >
        ,{cents.split('').map((ch, i) => <DigitCol key={`c${i}`} digit={Number(ch)} />)}
      </span>
    </span>
  )
}
