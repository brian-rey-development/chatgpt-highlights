import { describe, expect, it } from 'vitest'
import { ACCENT_FALLBACKS, HIGHLIGHT_COLORS, type HighlightColor } from '@/model'
import { FLASH_LAYER, HIGHLIGHT_STYLES, layerName } from './highlight-styles'

const accentToken = (color: HighlightColor): string =>
  `var(--color-chat-accent-${color}, ${ACCENT_FALLBACKS[color]})`

const ruleFor = (layer: string): string => {
  const line = HIGHLIGHT_STYLES.split('\n').find((row) => row.startsWith(`::highlight(${layer})`))
  if (!line) throw new Error(`no rule for ${layer}`)
  return line
}

describe('layerName', () => {
  it('names plain and noted layers per color', () => {
    expect(layerName('pink', false)).toBe('hl-pink')
    expect(layerName('pink', true)).toBe('hl-pink-note')
  })
})

describe('HIGHLIGHT_STYLES', () => {
  it.each(HIGHLIGHT_COLORS)('fills %s from the chat accent token with its fallback', (color) => {
    const accent = accentToken(color)
    const fill = `color-mix(in oklab, ${accent} var(--hl-mix), transparent)`
    expect(ruleFor(`hl-${color}`)).toContain(`background-color: ${fill};`)
    expect(ruleFor(`hl-${color}-note`)).toContain(`background-color: ${fill};`)
  })

  it.each(HIGHLIGHT_COLORS)('underlines %s note layers in the accent color', (color) => {
    const accent = accentToken(color)
    expect(ruleFor(`hl-${color}-note`)).toContain(`text-decoration: underline solid ${accent} 2px;`)
    expect(ruleFor(`hl-${color}`)).not.toContain('text-decoration')
  })

  it('mixes 34% in light and 40% in dark', () => {
    expect(HIGHLIGHT_STYLES).toContain(':root { --hl-mix: 34%; }')
    expect(HIGHLIGHT_STYLES).toContain(':root[data-theme="dark"] { --hl-mix: 40%; }')
  })

  it('styles the flash layer', () => {
    expect(ruleFor(FLASH_LAYER)).toContain('background-color: color-mix(in oklab,')
  })

  it('hardcodes no color outside the accent fallbacks', () => {
    const withoutFallbacks = Object.values(ACCENT_FALLBACKS).reduce(
      (css, hex) => css.replaceAll(hex, ''),
      HIGHLIGHT_STYLES,
    )
    expect(withoutFallbacks.replace('#0d0d0d', '')).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
