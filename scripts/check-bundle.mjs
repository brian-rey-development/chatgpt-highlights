import { existsSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BYTES_PER_KIB = 1024
const BUDGET_KIB = 28
const BUDGET_BYTES = BUDGET_KIB * BYTES_PER_KIB
const BUNDLES = [
  'dist/chrome-mv3/content-scripts/chatgpt.js',
  'dist/firefox-mv3/content-scripts/chatgpt.js',
]
const FORBIDDEN = [
  [/\bZod[A-Z]\w*|\$ZodType/, 'zod'],
  [/indexedDB\.open/, 'IndexedDB'],
  [/hl:anchor/, 'e2e timing'],
]

const gzippedSize = (path) => gzipSync(readFileSync(path)).length

const bundleIssues = (path) => {
  if (!existsSync(path)) return [`${path} missing; run pnpm build`]
  const size = gzippedSize(path)
  const text = readFileSync(path, 'utf8')
  return [
    ...(size > BUDGET_BYTES ? [`${path} is ${size} B gzipped, budget ${BUDGET_BYTES} B`] : []),
    ...FORBIDDEN.filter(([pattern]) => pattern.test(text)).map(
      ([, name]) => `${path} bundles ${name}`,
    ),
  ]
}

const issues = BUNDLES.flatMap(bundleIssues)
for (const issue of issues) process.stderr.write(`${issue}\n`)
process.exitCode = issues.length > 0 ? 1 : 0
