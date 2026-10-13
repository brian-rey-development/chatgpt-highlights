import { describe, expect, it } from 'vitest'
import { makeHighlight, makeQuote } from '@/testing'
import { highlightToMarkdown, renderMarkdown, toBlockquote } from './markdown'

const plain = makeHighlight({ quote: makeQuote({ exact: 'Plain quote' }) })
const annotated = makeHighlight({
  id: 'highlight-2',
  quote: makeQuote({ exact: 'First line\nSecond line' }),
  note: 'Worth revisiting.',
  tags: ['deep-work', 'ideas'],
})

const GOLDEN = `# Highlights

## Planning a trip

https://example.test/c/conversation-1

> Plain quote

> First line
> Second line

Worth revisiting.

Tags: #deep-work #ideas

## Second chat

https://example.test/c/conversation-2

> Plain quote
`

describe('toBlockquote', () => {
  it.each([
    { name: 'one line', text: 'one', expected: '> one' },
    { name: 'several lines', text: 'one\ntwo', expected: '> one\n> two' },
    { name: 'Windows line breaks', text: 'one\r\ntwo', expected: '> one\n> two' },
    { name: 'a blank line', text: 'one\n\ntwo', expected: '> one\n> \n> two' },
    { name: 'empty text', text: '', expected: '> ' },
  ])('quotes $name', ({ text, expected }) => {
    expect(toBlockquote(text)).toBe(expected)
  })
})

describe('highlightToMarkdown', () => {
  it('quotes a single line', () => {
    expect(highlightToMarkdown(plain)).toBe('> Plain quote')
  })

  it('prefixes every quote line and appends the note and the tags', () => {
    expect(highlightToMarkdown(annotated)).toBe(
      '> First line\n> Second line\n\nWorth revisiting.\n\nTags: #deep-work #ideas',
    )
  })

  it('omits the note paragraph when the note is empty', () => {
    const tagged = makeHighlight({ tags: ['one'] })
    expect(highlightToMarkdown(tagged)).toBe('> highlighted text\n\nTags: #one')
  })

  it('omits the tags line when there are no tags', () => {
    const noted = makeHighlight({ note: 'Only a note' })
    expect(highlightToMarkdown(noted)).toBe('> highlighted text\n\nOnly a note')
  })

  it('normalizes Windows line breaks inside the quote', () => {
    const windows = makeHighlight({ quote: makeQuote({ exact: 'one\r\ntwo' }) })
    expect(highlightToMarkdown(windows)).toBe('> one\n> two')
  })
})

describe('renderMarkdown', () => {
  const groups = [
    {
      title: 'Planning a trip',
      url: 'https://example.test/c/conversation-1',
      highlights: [plain, annotated],
    },
    { title: 'Second chat', url: 'https://example.test/c/conversation-2', highlights: [plain] },
  ]

  it('matches the golden document', () => {
    expect(renderMarkdown(groups)).toBe(GOLDEN)
  })

  it('uses the per-highlight block for every highlight', () => {
    const rendered = renderMarkdown(groups)
    expect(rendered).toContain(highlightToMarkdown(annotated))
  })

  it('renders only the heading when there is nothing to export', () => {
    expect(renderMarkdown([])).toBe('# Highlights\n')
  })

  it('renders a group without highlights as its heading and link', () => {
    const empty = [{ title: 'Empty chat', url: 'https://example.test/c/e', highlights: [] }]
    expect(renderMarkdown(empty)).toBe(
      '# Highlights\n\n## Empty chat\n\nhttps://example.test/c/e\n',
    )
  })
})
