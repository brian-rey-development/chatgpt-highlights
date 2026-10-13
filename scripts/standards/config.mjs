export const EM_DASH = '\u{2014}'
export const MAX_LINE = 100
export const CODE_LINES_PER_COMMENT = 20
export const MAX_DEPTH_BELOW_SRC = 3
export const TESTING_DIR = 'src/testing/'
export const E2E_DIR = 'e2e/'
export const E2E_TEST_SUPPORT = new Set(['@/testing/factories', '@/testing/fixture-ids'])

export const EDGES = {
  model: [],
  errors: ['model'],
  schemas: ['model', 'messaging', 'errors'],
  anchoring: ['model'],
  chatgpt: ['model', 'markdown'],
  painter: ['model', 'errors'],
  retention: ['model'],
  markdown: ['model'],
  backup: ['model', 'schemas', 'errors'],
  storage: ['model', 'errors', 'retention', 'backup'],
  messaging: ['model', 'errors'],
  ui: ['model', 'errors', 'retention'],
}
export const DOMAINS = Object.keys(EDGES)
export const ROOTS = new Set([...DOMAINS, 'entrypoints', 'testing'])

export const BROWSER_API = /^(wxt(\/|$)|@wxt-dev\/|webextension-polyfill$)/
export const BROWSER_API_LAYERS = new Set(['messaging', 'entrypoints'])
export const CONTENT_ENTRY = 'src/entrypoints/chatgpt.content/'
export const CONTENT_BANNED = new Set(['schemas', 'backup', 'storage', 'zod', 'idb'])
export const RELATIVE_SPEC = /^\.\.?(\/|$)/
export const FOREIGN_ALIAS = /^(~~?|@@)(\/|$)/

export const BANNED_DIR = /^(lib|libs|util|utils|helper|helpers|shared|common|misc|core)$/i
export const NAME_RULES = {
  ts: /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.test)?\.ts$/,
  tsx: /^[A-Z][A-Za-z0-9]*(\.test)?\.tsx$/,
  css: /^([a-z][a-z0-9]*(-[a-z0-9]+)*|[A-Z][A-Za-z0-9]*)\.css$/,
}

export const SOURCE = /^(src|e2e)\/.*\.[cm]?[jt]sx?$/
export const TYPESCRIPT = /\.tsx?$/
export const TEST = /\.test\.tsx?$/
export const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i
export const NO_TEST_NEEDED = /(^|\/)(index\.tsx?|types\.ts)$/
export const CLASS_ALLOWED = new Set(['src/errors/app-error.ts'])

export const COMMENT = /^\s*\/\//
export const BLOCK_COMMENT = /^\s*\/\*/
export const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/
export const HTML_INJECTION =
  /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|srcdoc)\b|document\.write|dangerouslySetInnerHTML/
export const BANNED_PATTERNS = [
  [HTML_INJECTION, 'raw HTML injection'],
  [/\blocalStorage\b/, 'localStorage writes into the chatgpt.com origin'],
  [/\bsetInterval\b/, 'polling; use events, observers or alarms'],
  [/\bconsole\./, 'console call'],
  [/@ts-(ignore|expect-error|nocheck)/, 'TypeScript suppression'],
]

export const layerOf = (file) => (file.startsWith(E2E_DIR) ? 'e2e' : file.split('/')[1])
export const isTestCode = (file) =>
  TEST.test(file) || file.startsWith(TESTING_DIR) || file.startsWith(E2E_DIR)
