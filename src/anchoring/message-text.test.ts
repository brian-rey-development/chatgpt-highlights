import { describe, expect, it } from 'vitest'
import type { Span } from '@/model'
import {
  conversationHtml,
  IGNORED_TEXT_SELECTOR,
  mountFixture,
  rangeOver,
  requireElement,
  TEXT_ROOT,
} from '@/testing'
import { type MessageText, rangeOfSpan, readMessageText, spanOfRange } from './message-text'

const textNodeOf = (root: Element, startsWith: string): Text => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && node.data.startsWith(startsWith)) return node
  }
  throw new Error(`no text node starting with ${startsWith}`)
}

const rangeBetween = (start: [Node, number], end: [Node, number]): Range => {
  const range = document.createRange()
  range.setStart(...start)
  range.setEnd(...end)
  return range
}

const mount = (html: string): { root: Element; message: MessageText } => {
  mountFixture(html)
  const root = requireElement('body > *')
  return { root, message: readMessageText(root, IGNORED_TEXT_SELECTOR) }
}

const sliceOf = (message: MessageText, span: { start: number; end: number } | null): string =>
  span ? message.text.slice(span.start, span.end) : ''

const everySpan = (length: number): Span[] =>
  Array.from({ length }, (_, start) => start).flatMap((start) =>
    Array.from({ length: length - start }, (_, extra) => ({ start, end: start + extra + 1 })),
  )

describe('readMessageText', () => {
  it('concatenates text nodes in document order', () => {
    const { message } = mount('<div>one <b>two</b> three</div>')
    expect(message.text).toBe('one two three')
  })

  it('records where each text node starts', () => {
    const { message } = mount('<div>one <b>two</b> three</div>')
    expect(message.starts).toEqual([0, 4, 7])
    expect(message.nodes.map((node) => node.data)).toEqual(['one ', 'two', ' three'])
  })

  it('skips subtrees that match the ignore selector', () => {
    const { message } = mount('<div>a<button>Copy</button><span aria-hidden="true">x</span>b</div>')
    expect(message.text).toBe('ab')
  })

  it('drops equation markup and the code header from the real fixture', () => {
    mountFixture(conversationHtml)
    const { text } = readMessageText(requireElement(TEXT_ROOT), IGNORED_TEXT_SELECTOR)
    expect(text).toContain('The force scales as F over distance cubed.')
    expect(text).not.toContain('Copy code')
  })

  it('returns an empty index for an empty root', () => {
    const { message } = mount('<div></div>')
    expect(message).toEqual({ text: '', nodes: [], starts: [] })
  })
})

describe('spanOfRange', () => {
  it('maps a range inside one text node', () => {
    const { root, message } = mount('<div>hello brave world</div>')
    const text = textNodeOf(root, 'hello')
    expect(spanOfRange(message, rangeBetween([text, 6], [text, 11]))).toEqual({ start: 6, end: 11 })
  })

  it('maps a range across elements', () => {
    const { root, message } = mount('<div>one <b>two</b> three</div>')
    const range = rangeBetween([textNodeOf(root, 'one'), 2], [textNodeOf(root, ' three'), 3])
    expect(spanOfRange(message, range)).toEqual({ start: 2, end: 10 })
  })

  it('trims surrounding whitespace', () => {
    const { root, message } = mount('<div>  padded text  </div>')
    const range = rangeOver(root)
    expect(spanOfRange(message, range)).toEqual({ start: 2, end: 13 })
  })

  it('returns exactly the paragraph for a triple click ending at the next element', () => {
    mountFixture(conversationHtml)
    const root = requireElement(TEXT_ROOT)
    const message = readMessageText(root, IGNORED_TEXT_SELECTOR)
    const nextElement = requireElement(`${TEXT_ROOT} ul`)
    const range = rangeBetween([textNodeOf(root, 'Tides'), 0], [nextElement, 0])
    const span = spanOfRange(message, range)
    expect(sliceOf(message, span)).toBe(
      'Tides come from the gravitational pull of the moon and the sun.',
    )
  })

  it('skips the part of a range that sits in ignored markup', () => {
    const { root, message } = mount('<div>before<button>Copy</button>after</div>')
    const range = rangeOver(root)
    expect(sliceOf(message, spanOfRange(message, range))).toBe('beforeafter')
  })

  it('returns null for a range outside the message', () => {
    mountFixture('<div id="inside">inside</div><div id="outside">outside</div>')
    const message = readMessageText(requireElement('#inside'), IGNORED_TEXT_SELECTOR)
    const range = rangeOver(requireElement('#outside'))
    expect(spanOfRange(message, range)).toBeNull()
  })

  it('returns null for an empty range', () => {
    const { root, message } = mount('<div>a   b</div>')
    const text = textNodeOf(root, 'a')
    expect(spanOfRange(message, rangeBetween([text, 2], [text, 2]))).toBeNull()
  })

  it('returns null for a whitespace-only range', () => {
    const { root, message } = mount('<div>a   b</div>')
    const text = textNodeOf(root, 'a')
    expect(spanOfRange(message, rangeBetween([text, 1], [text, 4]))).toBeNull()
  })
})

describe('rangeOfSpan', () => {
  it('selects the same text as the range it came from', () => {
    const { root, message } = mount('<div>one <b>two</b> three</div>')
    const range = rangeBetween([textNodeOf(root, 'one'), 2], [textNodeOf(root, ' three'), 3])
    const span = spanOfRange(message, range)
    expect(span && rangeOfSpan(message, span)?.toString()).toBe(range.toString())
  })

  it('selects the trimmed text of a padded range', () => {
    const { root, message } = mount('<div>  padded text  </div>')
    const range = rangeOver(root)
    const span = spanOfRange(message, range)
    expect(span && rangeOfSpan(message, span)?.toString()).toBe('padded text')
  })

  it('starts in the next text node when the span begins on a node boundary', () => {
    const { root, message } = mount('<div>one <b>two</b> three</div>')
    const range = rangeOfSpan(message, { start: 4, end: 7 })
    expect(range?.startContainer).toBe(textNodeOf(root, 'two'))
    expect(range?.startOffset).toBe(0)
    expect(range?.toString()).toBe('two')
  })

  it.each([
    { name: 'a negative start', span: { start: -1, end: 3 } },
    { name: 'an end past the text', span: { start: 0, end: 99 } },
    { name: 'an empty span', span: { start: 2, end: 2 } },
    { name: 'an inverted span', span: { start: 5, end: 2 } },
  ])('returns null for $name', ({ span }) => {
    const { message } = mount('<div>short</div>')
    expect(rangeOfSpan(message, span)).toBeNull()
  })

  it('returns null for an empty message', () => {
    const { message } = mount('<div></div>')
    expect(rangeOfSpan(message, { start: 0, end: 1 })).toBeNull()
  })

  it('resolves every span of a message whose empty text nodes share offsets with real text', () => {
    const { root } = mount('<div><b>one </b><i>two</i></div>')
    for (const element of root.querySelectorAll('b, i')) {
      element.prepend(document.createTextNode(''))
      element.append(document.createTextNode(''))
    }
    root.prepend(document.createTextNode(''))
    root.append(document.createTextNode(''))
    const message = readMessageText(root, IGNORED_TEXT_SELECTOR)
    const { length } = message.text
    for (const span of everySpan(length)) {
      expect(rangeOfSpan(message, span)?.toString()).toBe(sliceOf(message, span))
    }
  })
})
