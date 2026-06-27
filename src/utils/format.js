export const brl = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export const rarityLabel = {
  Common: 'Comum',
  Uncommon: 'Incomum',
  Rare: 'Rara',
  'Rare Holo': 'Rara Holográfica',
  'Double Rare': 'Rara Dupla',
  'Ultra Rare': 'Ultra Rara',
  'Illustration Rare': 'Rara Ilustrada',
  'Special Illustration Rare': 'Rara Ilustrada Especial',
  'Hyper Rare': 'Hiper Rara',
}

export const rarityColor = {
  Common: 'text-gray-400',
  Uncommon: 'text-green-400',
  Rare: 'text-blue-400',
  'Rare Holo': 'text-blue-300',
  'Double Rare': 'text-purple-400',
  'Ultra Rare': 'text-yellow-400',
  'Illustration Rare': 'text-pink-400',
  'Special Illustration Rare': 'text-pink-300',
  'Hyper Rare': 'text-amber-300',
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export function diffLabel(current, initial) {
  const diff = current - initial
  if (Math.abs(diff) < 0.01) return null
  const sign = diff > 0 ? '+' : ''
  return { diff, label: `${sign}${brl(diff)}`, positive: diff > 0 }
}
