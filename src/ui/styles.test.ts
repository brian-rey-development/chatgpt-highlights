import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OVERLAY_STYLES } from './styles'

const UI_DIR = import.meta.dirname
const THEME = 'theme.css'
const BASE = 'base.css'

const sheetText = (path: string): string => readFileSync(join(UI_DIR, path), 'utf8').trim()
const componentSheets = readdirSync(UI_DIR, { recursive: true, encoding: 'utf8' }).filter(
  (path) => path.endsWith('.css') && path !== THEME && path !== BASE,
)
const occurrences = (text: string): number => OVERLAY_STYLES.split(text).length - 1

const HOST_BLOCK = /:host\s*\{([^}]*)\}/
const DECLARATION = /^\s*([a-z-]+)\s*:/gm

describe('overlay styles', () => {
  it('declares only custom properties on the host, since all: initial erases the rest', () => {
    const block = HOST_BLOCK.exec(sheetText(THEME))?.[1] ?? ''
    const properties = [...block.matchAll(DECLARATION)].map((match) => match[1])
    expect(properties.length).toBeGreaterThan(0)
    expect(properties.filter((name) => !name?.startsWith('--'))).toEqual([])
  })

  it('opens with the theme and then the base, ahead of every component', () => {
    const baseAt = OVERLAY_STYLES.indexOf(sheetText(BASE))
    expect(OVERLAY_STYLES.indexOf(sheetText(THEME))).toBe(0)
    expect(baseAt).toBeGreaterThan(0)
    for (const path of componentSheets) {
      expect(OVERLAY_STYLES.indexOf(sheetText(path))).toBeGreaterThan(baseAt)
    }
  })

  it('starts font and color on the overlay container from the aliases', () => {
    const block = /\.hl-overlay\s*\{([^}]*)\}/.exec(sheetText(BASE))?.[1] ?? ''
    expect(block).toMatch(/font-family:\s*var\(--hl-font\)/)
    expect(block).toMatch(/color:\s*var\(--hl-text\)/)
  })

  it('finds the component sheets', () => {
    expect(componentSheets.length).toBeGreaterThan(5)
  })

  it.each(componentSheets)('holds %s exactly once', (path) => {
    expect(occurrences(sheetText(path))).toBe(1)
  })
})
