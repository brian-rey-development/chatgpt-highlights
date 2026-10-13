import base from './base.css?inline'
import theme from './theme.css?inline'

const COMPONENT_SHEETS = import.meta.glob<string>(['./**/*.css', '!./theme.css', '!./base.css'], {
  query: '?inline',
  import: 'default',
  eager: true,
})

export const OVERLAY_STYLES = [theme, base, ...Object.values(COMPONENT_SHEETS)].join('\n')
