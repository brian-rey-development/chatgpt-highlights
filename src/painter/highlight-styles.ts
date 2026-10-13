import { ACCENT_FALLBACKS, HIGHLIGHT_COLORS, type HighlightColor } from '@/model'

export const FLASH_LAYER = 'hl-flash'

const LIGHT_MIX = '34%'
const DARK_MIX = '40%'
const NOTE_UNDERLINE = '2px'
const FLASH_INK = 'var(--color-text, #0d0d0d)'
const FLASH_MIX = '22%'

export const layerName = (color: HighlightColor, hasNote: boolean): string =>
  hasNote ? `hl-${color}-note` : `hl-${color}`

const accentOf = (color: HighlightColor): string =>
  `var(--color-chat-accent-${color}, ${ACCENT_FALLBACKS[color]})`

const fillOf = (ink: string, mix: string): string =>
  `color-mix(in oklab, ${ink} ${mix}, transparent)`

const colorRules = (color: HighlightColor): string => {
  const fill = `background-color: ${fillOf(accentOf(color), 'var(--hl-mix)')};`
  const underline = `text-decoration: underline solid ${accentOf(color)} ${NOTE_UNDERLINE};`
  return [
    `::highlight(${layerName(color, false)}) { ${fill} }`,
    `::highlight(${layerName(color, true)}) { ${fill} ${underline} }`,
  ].join('\n')
}

const flashFill = `background-color: ${fillOf(FLASH_INK, FLASH_MIX)};`
const flashRule = `::highlight(${FLASH_LAYER}) { ${flashFill} }`

export const HIGHLIGHT_STYLES: string = [
  `:root { --hl-mix: ${LIGHT_MIX}; }`,
  `:root[data-theme="dark"] { --hl-mix: ${DARK_MIX}; }`,
  ...HIGHLIGHT_COLORS.map(colorRules),
  flashRule,
].join('\n')
