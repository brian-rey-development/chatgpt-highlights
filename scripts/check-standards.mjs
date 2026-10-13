import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parseSource } from './standards/ast.mjs'
import { BINARY, SOURCE } from './standards/config.mjs'
import {
  domainIndexIssues,
  emDashIssues,
  structureIssues,
  testIssues,
} from './standards/file-rules.mjs'
import { importIssues } from './standards/import-rules.mjs'
import { densityIssues, lineIssues } from './standards/line-rules.mjs'
import { castIssues, classIssues, typesFileIssues } from './standards/syntax-rules.mjs'

const SOURCE_RULES = [
  importIssues,
  castIssues,
  classIssues,
  typesFileIssues,
  lineIssues,
  densityIssues,
]

const repoFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file !== '' && !file.endsWith('pnpm-lock.yaml') && existsSync(file))

const sourceIssues = (file, text) => {
  const source = { file, text, lines: text.split('\n'), ...parseSource(file, text) }
  return SOURCE_RULES.flatMap((rule) => rule(source))
}

const textIssues = (file) => {
  const text = readFileSync(file, 'utf8')
  return [...emDashIssues({ text }), ...(SOURCE.test(file) ? sourceIssues(file, text) : [])]
}

const fileIssues = (file) => [
  ...(BINARY.test(file) ? [] : textIssues(file)),
  ...structureIssues(file),
  ...testIssues(file),
]

const report =
  (file) =>
  ({ line, message }) =>
    line ? `${file}:${line} ${message}` : `${file} ${message}`

const issues = [
  ...repoFiles.flatMap((file) => fileIssues(file).map(report(file))),
  ...domainIndexIssues(repoFiles),
]
for (const issue of new Set(issues)) process.stderr.write(`${issue}\n`)
process.exitCode = issues.length > 0 ? 1 : 0
