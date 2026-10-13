import { describe, expect, it } from 'vitest'
import { HIGHLIGHTER_ICON } from './icons'

describe('HIGHLIGHTER_ICON', () => {
  it('describes a 20px stroke glyph that follows the text color', () => {
    expect(HIGHLIGHTER_ICON.size).toBe(20)
    expect(HIGHLIGHTER_ICON.attributes).toEqual({
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    })
  })

  it('draws the marker and its stroke as two distinct paths', () => {
    expect(HIGHLIGHTER_ICON.paths).toHaveLength(2)
    expect(new Set(HIGHLIGHTER_ICON.paths).size).toBe(2)
  })
})
