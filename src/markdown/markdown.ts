import { type Highlight, tagLabel } from '@/model'

export interface MarkdownGroup {
  title: string
  url: string
  highlights: readonly Highlight[]
}

const LINE_BREAK = /\r?\n/
const QUOTE_PREFIX = '> '
const PARAGRAPH_BREAK = '\n\n'

export const toBlockquote = (text: string): string =>
  text
    .split(LINE_BREAK)
    .map((line) => `${QUOTE_PREFIX}${line}`)
    .join('\n')

const tagsOf = (highlight: Highlight): string =>
  highlight.tags.length === 0 ? '' : `Tags: ${highlight.tags.map(tagLabel).join(' ')}`

export const highlightToMarkdown = (highlight: Highlight): string =>
  [toBlockquote(highlight.quote.exact), highlight.note, tagsOf(highlight)]
    .filter((paragraph) => paragraph !== '')
    .join(PARAGRAPH_BREAK)

const groupToMarkdown = (group: MarkdownGroup): string =>
  [`## ${group.title}`, group.url, ...group.highlights.map(highlightToMarkdown)].join(
    PARAGRAPH_BREAK,
  )

export const renderMarkdown = (groups: readonly MarkdownGroup[]): string =>
  `${['# Highlights', ...groups.map(groupToMarkdown)].join(PARAGRAPH_BREAK)}\n`
