import {
  BANNED_PATTERNS,
  BLOCK_COMMENT,
  CODE_LINES_PER_COMMENT,
  COMMENT,
  isTestCode,
  MARKER,
  MAX_LINE,
  TEST,
} from './config.mjs'

const LINE_RULES = [
  [(line) => line.length > MAX_LINE, `line longer than ${MAX_LINE}`],
  [(line) => MARKER.test(line), 'leftover TODO marker'],
  [(line) => BLOCK_COMMENT.test(line), 'block comment; use one-line WHY comments'],
]

const BANNED_RULES = BANNED_PATTERNS.map(([pattern, why]) => [(line) => pattern.test(line), why])

const rulesFor = (file) => (isTestCode(file) ? LINE_RULES : [...LINE_RULES, ...BANNED_RULES])

export const lineIssues = ({ file, lines }) => {
  const rules = rulesFor(file)
  return lines.flatMap((line, index) =>
    rules.filter(([applies]) => applies(line)).map(([, message]) => ({ line: index + 1, message })),
  )
}

export const densityIssues = ({ file, lines }) => {
  if (TEST.test(file)) return []
  const comments = lines.filter((line) => COMMENT.test(line)).length
  const code = lines.filter((line) => line.trim() !== '' && !COMMENT.test(line)).length
  const allowed = Math.max(1, Math.floor(code / CODE_LINES_PER_COMMENT))
  return comments > allowed
    ? [{ message: `${comments} comments for ${code} code lines (max ${allowed})` }]
    : []
}
