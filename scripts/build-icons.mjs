import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ACCENT_FALLBACKS, DEFAULT_COLOR } from '../src/model/colors.ts'
import { HIGHLIGHTER_ICON } from '../src/model/icons.ts'

const SOURCE_PATH = 'assets/icon.svg'
const STORE_SOURCE_PATH = 'assets/icon-store.svg'
const OUTPUT_DIR = 'public/icons'
const TOOLBAR_SIZE = 16
const TOOLBAR_HIDPI_SIZE = 32
const EXTENSIONS_PAGE_SIZE = 48
const ADDONS_PAGE_SIZE = 96
const STORE_SIZE = 128
const STORE_ARTWORK = 96
const SIZES = [TOOLBAR_SIZE, TOOLBAR_HIDPI_SIZE, EXTENSIONS_PAGE_SIZE, ADDONS_PAGE_SIZE, STORE_SIZE]
const CANVAS = STORE_SIZE
const STORE_MARGIN = (CANVAS * (STORE_SIZE - STORE_ARTWORK)) / (2 * STORE_ARTWORK)
const CORNER_RADIUS = 28
const GLYPH_SCALE = 4
const GLYPH_STROKE = 3
// Center of the glyph paths, not of the viewBox
const GLYPH_CENTER = { x: 12.5, y: 11.25 }
const INK = '#1f1f1f'
const TITLE = 'Highlights for ChatGPT'

const GLYPH_TRANSFORM = [
  `translate(${CANVAS / 2} ${CANVAS / 2})`,
  `scale(${GLYPH_SCALE})`,
  `translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})`,
].join(' ')

const viewBox = (margin) => `${-margin} ${-margin} ${CANVAS + 2 * margin} ${CANVAS + 2 * margin}`

const iconSvg = (margin) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(margin)}">
  <title>${TITLE}</title>
  <rect width="${CANVAS}" height="${CANVAS}" rx="${CORNER_RADIUS}" fill="${ACCENT_FALLBACKS[DEFAULT_COLOR]}"/>
  <g transform="${GLYPH_TRANSFORM}" fill="none" stroke="${INK}" stroke-width="${GLYPH_STROKE}" stroke-linecap="round" stroke-linejoin="round">
${HIGHLIGHTER_ICON.paths.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`

const render = (size, source) =>
  execFileSync('rsvg-convert', [
    '-w',
    String(size),
    '-h',
    String(size),
    '-o',
    `${OUTPUT_DIR}/${size}.png`,
    source,
  ])

mkdirSync(dirname(SOURCE_PATH), { recursive: true })
mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(SOURCE_PATH, iconSvg(0))
writeFileSync(STORE_SOURCE_PATH, iconSvg(STORE_MARGIN))
for (const size of SIZES) render(size, size === STORE_SIZE ? STORE_SOURCE_PATH : SOURCE_PATH)
