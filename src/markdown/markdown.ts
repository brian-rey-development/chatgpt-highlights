import { type Highlight, tagLabel } from '@/model'

export interface MarkdownGroup {
  title: string
  url: string
  highlights: readonly Highlight[]
}

const LINE_BREAK = /\r\n|\r|\n/
const QUOTE_PREFIX = '> '
const PARAGRAPH_BREAK = '\n\n'
const INLINE_MARKS = /[\\`*_[\]<>~|]/g
const HEADING_MARKS = /[\\`*_[\]<>~|#]/g
const ENTITY = /&(?=#?\w+;)/g
const LEADING_MARK = /^(\s*)([#+=-])/
const LEADING_NUMBER = /^(\s*\d+)([.)])/
const ESCAPED_MARK = '\\$&'
const ESCAPED_LEADER = '$1\\$2'

const linesOf = (text: string): string[] => text.split(LINE_BREAK)

export const toBlockquote = (text: string): string =>
  linesOf(text)
    .map((line) => `${QUOTE_PREFIX}${line}`)
    .join('\n')

const escapeInline = (text: string, marks: RegExp = INLINE_MARKS): string =>
  text.replace(marks, ESCAPED_MARK).replace(ENTITY, '\\&')

const escapeLine = (line: string): string =>
  escapeInline(line).replace(LEADING_MARK, ESCAPED_LEADER).replace(LEADING_NUMBER, ESCAPED_LEADER)

const escapeText = (text: string): string => linesOf(text).map(escapeLine).join('\n')

const escapeTitle = (title: string): string => escapeInline(linesOf(title).join(' '), HEADING_MARKS)

const tagsOf = (highlight: Highlight): string =>
  highlight.tags.length === 0
    ? ''
    : `Tags: ${highlight.tags.map((tag) => tagLabel(escapeInline(tag))).join(' ')}`

export const highlightToMarkdown = (highlight: Highlight): string =>
  [toBlockquote(escapeText(highlight.quote.exact)), escapeText(highlight.note), tagsOf(highlight)]
    .filter((paragraph) => paragraph !== '')
    .join(PARAGRAPH_BREAK)

const groupToMarkdown = (group: MarkdownGroup): string =>
  [`## ${escapeTitle(group.title)}`, group.url, ...group.highlights.map(highlightToMarkdown)].join(
    PARAGRAPH_BREAK,
  )

export const renderMarkdown = (groups: readonly MarkdownGroup[]): string =>
  `${['# Highlights', ...groups.map(groupToMarkdown)].join(PARAGRAPH_BREAK)}\n`
