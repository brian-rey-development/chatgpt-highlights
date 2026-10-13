import { describe, expect, it } from 'vitest'
import { ACCENT_FALLBACKS, DEFAULT_COLOR, HIGHLIGHT_COLORS } from './colors'

describe('highlight colors', () => {
  it('offers the five ChatGPT accent colors in palette order', () => {
    expect(HIGHLIGHT_COLORS).toEqual(['yellow', 'green', 'blue', 'pink', 'purple'])
  })

  it('defaults to a color that is part of the palette', () => {
    expect(HIGHLIGHT_COLORS).toContain(DEFAULT_COLOR)
  })
})

describe('ACCENT_FALLBACKS', () => {
  it('holds one light-theme hex per palette color', () => {
    expect(Object.keys(ACCENT_FALLBACKS)).toEqual([...HIGHLIGHT_COLORS])
    for (const hex of Object.values(ACCENT_FALLBACKS)) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })
})
