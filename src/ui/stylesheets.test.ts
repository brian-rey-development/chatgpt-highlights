import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI_DIR = import.meta.dirname
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/i
const FOREIGN_TOKEN = /var\(--(?!hl-)/
const RADIUS_LITERAL = /border-radius:\s*(?!var\(--hl-radius-)(?!50%|3px)\S/
const Z_INDEX_LITERAL = /z-index:\s*(?!var\(--hl-layer-)\S/
const THEME = 'theme.css'
const BASE = 'base.css'
const IMPORT_LINE = /^import '(.+)'$/gm

const filesEndingWith = (dir: string, pattern: RegExp): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return filesEndingWith(path, pattern)
    return pattern.test(entry.name) ? [path] : []
  })

const read = (path: string): string => readFileSync(path, 'utf8')
const files = filesEndingWith(UI_DIR, /\.css$/)
const modules = filesEndingWith(UI_DIR, /(?<!\.test)\.tsx?$/)
const extensionSheets = files.filter((path) => !path.endsWith(THEME))
const componentSheets = extensionSheets.filter((path) => !path.endsWith(BASE))
const declared = new Set(
  files.flatMap((path) => read(path).match(/--hl-[a-z0-9-]+(?=\s*:)/g) ?? []),
)
const used = (css: string): readonly string[] =>
  [...css.matchAll(/var\((--hl-[a-z0-9-]+)/g)].map((match) => match[1] ?? '')
const importsOf = (path: string): readonly string[] =>
  [...read(path).matchAll(IMPORT_LINE)].map((match) => match[1] ?? '')

describe('extension stylesheets', () => {
  it('finds the component stylesheets', () => {
    expect(extensionSheets.length).toBeGreaterThan(5)
  })

  it.each(extensionSheets)('%s hardcodes no color', (path) => {
    expect(read(path)).not.toMatch(COLOR_LITERAL)
  })

  it.each(extensionSheets)('%s reads ChatGPT only through the --hl aliases', (path) => {
    expect(read(path)).not.toMatch(FOREIGN_TOKEN)
  })

  it.each(extensionSheets)('%s uses only aliases that theme.css or base.css define', (path) => {
    for (const alias of used(read(path))) expect(declared).toContain(alias)
  })

  it.each(extensionSheets)('%s takes every radius from the scale', (path) => {
    expect(read(path)).not.toMatch(RADIUS_LITERAL)
  })

  it.each(extensionSheets)('%s takes every stacking order from the layer tokens', (path) => {
    expect(read(path)).not.toMatch(Z_INDEX_LITERAL)
  })
})

describe('toast motion', () => {
  const toast = read(join(UI_DIR, 'Toast.css'))

  it('fades and rises in over 0.18s', () => {
    expect(toast).toMatch(/animation:\s*hl-toast-in 0\.18s/)
    expect(toast).toMatch(/@keyframes hl-toast-in/)
  })

  it('shows at once for people who ask for reduced motion', () => {
    expect(toast).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.hl-toast\s*\{\s*animation:\s*none/,
    )
  })
})

describe('stylesheet bundling', () => {
  it.each(componentSheets)('%s sits beside the component that owns it', (path) => {
    expect(existsSync(path.replace(/\.css$/, '.tsx'))).toBe(true)
  })

  it.each(modules)('%s leaves stylesheets to the overlay bundle', (path) => {
    expect(importsOf(path).filter((source) => source.endsWith('.css'))).toEqual([])
  })
})
