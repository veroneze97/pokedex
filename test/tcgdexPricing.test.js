import test from 'node:test'
import assert from 'node:assert/strict'
import { pickTcgplayerPrice } from '../api/_tcgdexPricing.js'

test('retorna marketPrice da variante normal quando presente', () => {
  const variants = [
    {
      type: 'normal',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          normal: { marketPrice: 0.11, lowPrice: 0.01 },
          'reverse-holofoil': { marketPrice: 0.36 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 0.11)
})

test('usa a primeira variante quando nao ha variante normal', () => {
  const variants = [
    {
      type: 'reverse-holofoil',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          'reverse-holofoil': { marketPrice: 0.36 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 0.36)
})

test('dentro da variante escolhida, cai pro primeiro tipo com marketPrice se nao houver normal', () => {
  const variants = [
    {
      type: 'normal',
      pricing: {
        tcgplayer: {
          unit: 'USD',
          updated: '2026-07-18T00:00:00Z',
          holofoil: { marketPrice: 4.2 },
        },
      },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), 4.2)
})

test('retorna null quando nao ha pricing.tcgplayer', () => {
  const variants = [{ type: 'normal', pricing: {} }]
  assert.equal(pickTcgplayerPrice(variants), null)
})

test('retorna null quando variantsDetailed esta vazio ou ausente', () => {
  assert.equal(pickTcgplayerPrice([]), null)
  assert.equal(pickTcgplayerPrice(undefined), null)
  assert.equal(pickTcgplayerPrice(null), null)
})

test('retorna null quando marketPrice e zero ou negativo em todos os tipos', () => {
  const variants = [
    {
      type: 'normal',
      pricing: { tcgplayer: { unit: 'USD', normal: { marketPrice: 0 } } },
    },
  ]
  assert.equal(pickTcgplayerPrice(variants), null)
})
