import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FAILURE_STATUS = 1
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const zipOf = (kind) => `dist/chatgpt-highlights-${version}-${kind}.zip`

const args = [
  'exec',
  'wxt',
  'submit',
  '--chrome-zip',
  zipOf('chrome'),
  '--firefox-zip',
  zipOf('firefox'),
  '--firefox-sources-zip',
  zipOf('sources'),
  ...process.argv.slice(2),
]

const result = spawnSync('pnpm', args, { stdio: 'inherit' })
process.exit(result.status ?? FAILURE_STATUS)
