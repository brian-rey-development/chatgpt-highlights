import { existsSync } from 'node:fs'
import {
  BANNED_DIR,
  DOMAINS,
  EM_DASH,
  isTestCode,
  MAX_DEPTH_BELOW_SRC,
  NAME_RULES,
  NO_TEST_NEEDED,
  ROOTS,
  SOURCE,
  TYPESCRIPT,
} from './config.mjs'

const issue = (message) => ({ message })

const rootIssues = (parts) =>
  ROOTS.has(parts[1]) ? [] : [issue(`unknown top-level folder src/${parts[1]}`)]

const folderIssues = (folders) => [
  ...folders
    .filter((dir) => BANNED_DIR.test(dir))
    .map((dir) => issue(`banned folder name "${dir}"`)),
  ...(folders.length > MAX_DEPTH_BELOW_SRC
    ? [issue('nested deeper than three folders below src')]
    : []),
]

const nameIssues = (name) => {
  const rule = NAME_RULES[name.split('.').at(-1)]
  return rule && !rule.test(name) ? [issue(`bad file name ${name}`)] : []
}

const languageIssues = (file) =>
  SOURCE.test(file) && !TYPESCRIPT.test(file) ? [issue('non-TypeScript source')] : []

export const structureIssues = (file) => {
  if (!file.startsWith('src/')) return []
  const parts = file.split('/')
  return [
    ...rootIssues(parts),
    ...folderIssues(parts.slice(1, -1)),
    ...nameIssues(parts.at(-1)),
    ...languageIssues(file),
  ]
}

export const testIssues = (file) => {
  const exempt = isTestCode(file) || NO_TEST_NEEDED.test(file)
  if (!SOURCE.test(file) || !TYPESCRIPT.test(file) || exempt) return []
  const base = file.replace(TYPESCRIPT, '')
  const tested = [`${base}.test.ts`, `${base}.test.tsx`].some((test) => existsSync(test))
  return tested ? [] : [issue('missing colocated test file')]
}

export const emDashIssues = ({ text }) =>
  text.includes(EM_DASH) ? [issue('contains an em dash')] : []

export const domainIndexIssues = (files) =>
  DOMAINS.filter((domain) => files.some((file) => file.startsWith(`src/${domain}/`)))
    .filter((domain) => !existsSync(`src/${domain}/index.ts`))
    .map((domain) => `src/${domain} has no index.ts`)
