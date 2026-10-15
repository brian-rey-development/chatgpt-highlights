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
    { name: 'old Mac line breaks', text: 'one\rtwo', expected: '> one\n> two' },
    { name: 'mixed line breaks', text: 'a\r\nb\rc\nd', expected: '> a\n> b\n> c\n> d' },
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

describe('escaping embedded content', () => {
  const quoted = (exact: string, overrides = {}) =>
    highlightToMarkdown(makeHighlight({ quote: makeQuote({ exact }), ...overrides }))

  it.each([
    { name: 'a heading', exact: '# Title', expected: '> \\# Title' },
    { name: 'a list marker', exact: '- one\n+ two', expected: '> \\- one\n> \\+ two' },
    {
      name: 'a numbered list',
      exact: '1. first\n2) second',
      expected: '> 1\\. first\n> 2\\) second',
    },
    { name: 'a setext underline', exact: 'Title\n===', expected: '> Title\n> \\===' },
    { name: 'emphasis', exact: '*bold* and _it_', expected: '> \\*bold\\* and \\_it\\_' },
    { name: 'a link', exact: '[x](http://evil.test)', expected: '> \\[x\\](http://evil.test)' },
    { name: 'inline code', exact: 'run `rm -rf`', expected: '> run \\`rm -rf\\`' },
    { name: 'html', exact: '<img src=x onerror=1>', expected: '> \\<img src=x onerror=1\\>' },
    { name: 'a character entity', exact: 'a &lt; b', expected: '> a \\&lt; b' },
    { name: 'a backslash', exact: 'a\\*b', expected: '> a\\\\\\*b' },
  ])('escapes $name in the quote', ({ exact, expected }) => {
    expect(quoted(exact)).toBe(expected)
  })

  it('leaves plain ampersands, dashes and numbers alone', () => {
    expect(quoted('R&D costs 3-4 times, see 2024.')).toBe('> R&D costs 3-4 times, see 2024.')
  })

  it('escapes the note line by line', () => {
    const rendered = quoted('x', { note: '# Heading\r<b>bold</b>' })
    expect(rendered).toBe('> x\n\n\\# Heading\n\\<b\\>bold\\</b\\>')
  })

  it('escapes the characters of a tag but keeps its hash', () => {
    expect(quoted('x', { tags: ['a_b', '[c]'] })).toBe('> x\n\nTags: #a\\_b #\\[c\\]')
  })

  it('escapes the chat title and keeps it on one line', () => {
    const group = { title: '# Hi\n*you* #', url: 'https://example.test/c/1', highlights: [] }
    expect(renderMarkdown([group])).toContain('## \\# Hi \\*you\\* \\#\n')
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
