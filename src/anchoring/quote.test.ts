import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LIMITS } from '@/model'
import { describeQuote, locateQuote } from './quote'

const PROPERTY_RUNS = 500

describe('describeQuote', () => {
  it('stores the exact text, its offsets and the surrounding context', () => {
    expect(describeQuote('one two three', { start: 4, end: 7 })).toEqual({
      exact: 'two',
      prefix: 'one ',
      suffix: ' three',
      start: 4,
      end: 7,
    })
  })

  it('caps the prefix and suffix at the context limit', () => {
    const text = `${'a'.repeat(100)}TARGET${'b'.repeat(100)}`
    const quote = describeQuote(text, { start: 100, end: 106 })
    expect(quote.prefix).toBe('a'.repeat(LIMITS.contextChars))
    expect(quote.suffix).toBe('b'.repeat(LIMITS.contextChars))
  })

  it('stores an empty prefix at the start and an empty suffix at the end', () => {
    const quote = describeQuote('whole', { start: 0, end: 5 })
    expect(quote.prefix).toBe('')
    expect(quote.suffix).toBe('')
  })
})

describe('locateQuote', () => {
  it('prefers the stored offsets when the text there still matches', () => {
    const text = 'cat dog cat dog'
    const quote = describeQuote(text, { start: 8, end: 11 })
    expect(locateQuote(text, quote)).toEqual({ start: 8, end: 11 })
  })

  it('relocates the original occurrence of a duplicate phrase after offsets shift', () => {
    const original = 'alpha repeat omega. beta repeat gamma.'
    const start = original.lastIndexOf('repeat')
    const quote = describeQuote(original, { start, end: start + 'repeat'.length })
    const opening = 'A new opening sentence. '
    const found = locateQuote(`${opening}${original}`, quote)
    expect(found?.start).toBe(start + opening.length)
  })

  it('picks the occurrence with the most matching context characters', () => {
    const quote = { exact: 'tide', prefix: 'the high ', suffix: ' rises', start: 0, end: 4 }
    const text = 'a low tide falls, the high tide rises, a calm tide'
    expect(locateQuote(text, quote)).toEqual({ start: 27, end: 31 })
  })

  it('breaks context ties by distance to the stored start', () => {
    const quote = { exact: 'x', prefix: '', suffix: '', start: 9, end: 10 }
    expect(locateQuote('x...x.....x', quote)).toEqual({ start: 10, end: 11 })
  })

  it('does not reattach to a duplicate when the context moved away from the stored offsets', () => {
    const quote = describeQuote('aaa', { start: 1, end: 3 })
    expect(locateQuote('xaaa', quote)).toEqual({ start: 2, end: 4 })
  })

  it('finds overlapping occurrences', () => {
    const quote = { exact: 'aa', prefix: 'b', suffix: 'c', start: 3, end: 5 }
    expect(locateQuote('aaabaac', quote)).toEqual({ start: 4, end: 6 })
  })

  it('returns null when the exact text is gone', () => {
    const quote = describeQuote('the original text', { start: 4, end: 12 })
    expect(locateQuote('the rewritten text', quote)).toBeNull()
  })

  it('returns null for an empty quote', () => {
    const quote = { exact: '', prefix: '', suffix: '', start: 0, end: 0 }
    expect(locateQuote('anything', quote)).toBeNull()
  })

  it('round-trips any span of any text', () => {
    const spanned = fc
      .string({ minLength: 1, maxLength: 200 })
      .chain((text) =>
        fc
          .tuple(fc.nat(text.length - 1), fc.nat(text.length - 1))
          .map(([a, b]) => ({ text, span: { start: Math.min(a, b), end: Math.max(a, b) + 1 } })),
      )
    fc.assert(
      fc.property(spanned, ({ text, span }) => {
        expect(locateQuote(text, describeQuote(text, span))).toEqual(span)
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })

  it('relocates any span after text is prepended', () => {
    const text = fc.string({ unit: fc.constantFrom('a', 'b', ' '), minLength: 1, maxLength: 120 })
    const pad = fc.string({ unit: fc.constant('z'), minLength: 1, maxLength: 40 })
    const spanned = text.chain((value) =>
      fc.tuple(fc.nat(value.length - 1), fc.nat(value.length - 1), pad).map(([a, b, padding]) => ({
        text: value,
        padding,
        span: { start: Math.min(a, b), end: Math.max(a, b) + 1 },
      })),
    )
    fc.assert(
      fc.property(spanned, ({ text: original, padding, span }) => {
        const quote = describeQuote(original, span)
        const found = locateQuote(`${padding}${original}`, quote)
        expect(found).not.toBeNull()
        expect(`${padding}${original}`.slice(found?.start, found?.end)).toBe(quote.exact)
        if (original.indexOf(quote.exact) === original.lastIndexOf(quote.exact)) {
          expect(found?.start).toBe(span.start + padding.length)
        }
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })

  it('relocates a unique span after text is prepended', () => {
    const text = 'Tides come from the gravitational pull of the moon and the sun.'
    const start = text.indexOf('moon')
    const quote = describeQuote(text, { start, end: start + 'moon'.length })
    const opening = 'Intro. '
    expect(locateQuote(`${opening}${text}`, quote)?.start).toBe(start + opening.length)
  })
})
