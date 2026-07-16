import test from 'node:test'
import assert from 'node:assert/strict'
import { isDesktopWidth } from '../src/hooks/useIsDesktop.js'

test('considera desktop a partir de 1024px', () => {
  assert.equal(isDesktopWidth(1023), false)
  assert.equal(isDesktopWidth(1024), true)
  assert.equal(isDesktopWidth(1440), true)
})
