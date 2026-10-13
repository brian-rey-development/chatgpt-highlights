import { describe, expect, it } from 'vitest'
import { countPaintedRanges, installFakeHighlightApi } from './highlight-api'

const layerOf = (...ranges: Range[]): Highlight => {
  const layer = new Highlight()
  for (const range of ranges) layer.add(range)
  return layer
}

describe('countPaintedRanges', () => {
  it('counts the ranges of every layer', () => {
    const registry = installFakeHighlightApi()
    const first = layerOf(new Range())
    registry.set('hl-yellow', first)
    registry.set('hl-green', layerOf(new Range(), new Range()))
    expect(countPaintedRanges(registry)).toBe(3)
    first.clear()
    expect(countPaintedRanges(registry)).toBe(2)
  })

  it('is zero for an empty registry', () => {
    expect(countPaintedRanges(installFakeHighlightApi())).toBe(0)
  })
})
