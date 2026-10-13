import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCENT_FALLBACKS, HIGHLIGHT_COLORS } from '@/model'

const css = readFileSync(join(import.meta.dirname, 'theme.css'), 'utf8')

const withFallback = (token: string, fallback: string): string => `var(${token}, ${fallback})`

const FONT_FALLBACK = [
  '-apple-system-body',
  'ui-sans-serif',
  '-apple-system',
  'system-ui',
  '"Segoe UI"',
  'Helvetica',
  '"Apple Color Emoji"',
  'Arial',
  'sans-serif',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(', ')

const SHADOW = [
  withFallback('--shadow-lg', '0 4px 8px -2px #0000001a'),
  `0 0 0 0.5px ${withFallback('--shadow-hairline-color', '#0000001a')}`,
].join(', ')

const ALIASES: readonly (readonly [alias: string, expected: string])[] = [
  ['--hl-font', withFallback('--font-ui-family', FONT_FALLBACK)],
  ['--hl-surface', withFallback('--color-surface', '#fcfcfc')],
  ['--hl-elevated', withFallback('--color-surface-elevated-secondary', '#ffffff')],
  ['--hl-text', withFallback('--color-text', '#0d0d0d')],
  ['--hl-text-secondary', withFallback('--color-text-secondary', '#5d5d5d')],
  ['--hl-text-tertiary', withFallback('--color-text-tertiary', '#8f8f8f')],
  ['--hl-text-inverse', withFallback('--color-text-inverse', '#ffffff')],
  ['--hl-border', withFallback('--color-border', '#0000001a')],
  ['--hl-border-subtle', withFallback('--color-border-subtle', '#0000000d')],
  ['--hl-border-strong', withFallback('--color-border-strong', '#00000026')],
  ['--hl-border-pill', 'color-mix(in srgb, var(--hl-border) 70%, transparent)'],
  ['--hl-hover', withFallback('--color-background-primary-soft-hover', '#0000000d')],
  ['--hl-field', withFallback('--composer-background-color', '#ffffff')],
  ['--hl-shadow', SHADOW],
  ['--hl-shadow-pill', withFallback('--shadow-lg', '0 4px 8px -2px #0000001a')],
  ['--hl-text-sm', withFallback('--text-sm', '14px')],
  ['--hl-text-xs', withFallback('--text-xs', '12px')],
  ['--hl-text-base', withFallback('--text-base', '16px')],
  ['--hl-text-2xl', withFallback('--text-2xl', '24px')],
  ...HIGHLIGHT_COLORS.map(
    (color) =>
      [
        `--hl-${color}`,
        withFallback(`--color-chat-accent-${color}`, ACCENT_FALLBACKS[color]),
      ] as const,
  ),
  ['--hl-danger', withFallback('--color-text-danger', '#e02e2a')],
  ['--hl-radius-control', '6px'],
  ['--hl-radius-pill', '8px'],
  ['--hl-radius-item', '10px'],
  ['--hl-radius-card', '12px'],
  ['--hl-radius-panel', '16px'],
  ['--hl-radius-round', '9999px'],
  ['--hl-layer-library', '40'],
  ['--hl-layer-pill', '50'],
  ['--hl-layer-popover', '60'],
  ['--hl-layer-toast', '80'],
]

const declaration = (alias: string): string => {
  const value = css.match(new RegExp(`${alias}:\\s*([^;]+);`))?.[1] ?? ''
  return value.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim()
}

describe('theme.css', () => {
  it('scopes the aliases to the shadow host', () => {
    expect(css).toMatch(/^:host\s*\{/)
  })

  it.each(ALIASES)('declares %s as its ChatGPT token or fixed value', (alias, expected) => {
    expect(declaration(alias)).toBe(expected)
  })
})
