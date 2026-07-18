// Extrai o preço de mercado (TCGplayer, USD) de uma carta da TCGdex.
// Prefere a variante 'normal'; se a carta não tiver, usa a primeira da
// lista. Dentro do objeto tcgplayer da variante escolhida, prefere o tipo
// 'normal' (ex: quando a variante em si é 'reverse-holofoil' mas o objeto
// tcgplayer também lista preço 'normal'); senão usa o primeiro tipo com
// marketPrice > 0 (ex: carta só existe em holofoil).

const NON_PRICE_KEYS = new Set(['unit', 'updated'])

export function pickTcgplayerPrice(variantsDetailed) {
  if (!Array.isArray(variantsDetailed) || variantsDetailed.length === 0) return null

  const variant = variantsDetailed.find(v => v.type === 'normal') || variantsDetailed[0]
  const tcgplayer = variant?.pricing?.tcgplayer
  if (!tcgplayer) return null

  if (tcgplayer.normal?.marketPrice > 0) return tcgplayer.normal.marketPrice

  const fallbackKey = Object.keys(tcgplayer).find(
    key => !NON_PRICE_KEYS.has(key) && tcgplayer[key]?.marketPrice > 0
  )
  return fallbackKey ? tcgplayer[fallbackKey].marketPrice : null
}
