// Cor de glow por tipo Pokémon nos CardTiles possuídos.
// Fallback: dourado (cor de marca do app) — cobre cartas sem tipo salvo
// ainda, ou tipos fora do mapa (não deve nunca quebrar o layout).

const TYPE_COLORS = {
  grama: [60, 199, 120],
  planta: [60, 199, 120], // TCGdex PT-BR usa "Planta" para o tipo Grama
  fogo: [255, 90, 64],
  agua: [56, 150, 255],
  eletrico: [240, 200, 40],
  psiquico: [147, 112, 246],
  lutador: [200, 110, 50],
  sombrio: [110, 96, 140],
  metalico: [160, 174, 190],
  fada: [244, 114, 182],
  dragao: [99, 102, 241],
  incolor: [176, 176, 176],
  // Aliases em inglês, caso a API retorne nomes não localizados
  grass: [60, 199, 120],
  fire: [255, 90, 64],
  water: [56, 150, 255],
  lightning: [240, 200, 40],
  electric: [240, 200, 40],
  psychic: [147, 112, 246],
  fighting: [200, 110, 50],
  darkness: [110, 96, 140],
  dark: [110, 96, 140],
  metal: [160, 174, 190],
  fairy: [244, 114, 182],
  dragon: [99, 102, 241],
  colorless: [176, 176, 176],
}

const GOLD_RGB = [245, 166, 35]

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function getTypeGlow(type) {
  const [r, g, b] = TYPE_COLORS[normalize(type)] || GOLD_RGB
  return {
    boxShadow: `0 0 0 1px rgba(${r},${g},${b},0.35), 0 0 20px -4px rgba(${r},${g},${b},0.55)`,
  }
}
