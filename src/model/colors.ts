export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]
export const DEFAULT_COLOR: HighlightColor = 'yellow'

export const ACCENT_FALLBACKS: Readonly<Record<HighlightColor, string>> = {
  yellow: '#ffcc38',
  green: '#04bb9f',
  blue: '#3566f0',
  pink: '#fa70ab',
  purple: '#a25bff',
}
