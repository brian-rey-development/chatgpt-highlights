import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LIMITS } from './limits'
import { addTag, normalizeTag, tagLabel } from './tags'

const MAX_TAG = 'a'.repeat(LIMITS.tagChars)
const TOO_LONG = 'a'.repeat(LIMITS.tagChars + 1)
const HALF_TAG = 'a'.repeat(LIMITS.tagChars / 2)
const fullTags = Array.from({ length: LIMITS.tags }, (_, index) => `tag-${index}`)

describe('normalizeTag', () => {
  it.each([
    ['  #Deep Work ', 'deep-work'],
    ['Deep   \t Work', 'deep-work'],
    ['##double', 'double'],
    ['# spaced', 'spaced'],
    ['# #a', 'a'],
    [' # # deep work', 'deep-work'],
    [`${HALF_TAG}     ${HALF_TAG.slice(1)}`, `${HALF_TAG}-${HALF_TAG.slice(1)}`],
    ['UPPER', 'upper'],
    ['already-ok', 'already-ok'],
    [MAX_TAG, MAX_TAG],
  ])('turns %j into %j', (raw, expected) => {
    expect(normalizeTag(raw)).toBe(expected)
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['a lone hash', '#'],
    ['a hash and spaces', ' # '],
    ['one char over the limit', TOO_LONG],
    ['over the limit once whitespace collapses', `${HALF_TAG}  ${HALF_TAG}`],
  ])('rejects %s', (_label, raw) => {
    expect(normalizeTag(raw)).toBeNull()
  })

  it('is idempotent over hashes, whitespace and letters', () => {
    const marked = fc.string({ unit: fc.constantFrom('#', ' ', '\t', 'a', 'B'), maxLength: 12 })
    fc.assert(
      fc.property(marked, (raw) => {
        const tag = normalizeTag(raw)
        if (tag !== null) expect(normalizeTag(tag)).toBe(tag)
      }),
    )
  })
})

describe('tagLabel', () => {
  it('shows a tag with a leading hash', () => {
    expect(tagLabel('deep-work')).toBe('#deep-work')
  })

  it('round-trips through normalizeTag', () => {
    expect(normalizeTag(tagLabel('deep-work'))).toBe('deep-work')
  })
})

describe('addTag', () => {
  it('appends the normalized tag', () => {
    expect(addTag(['one'], ' #Two Words ')).toEqual(['one', 'two-words'])
  })

  it('dedupes against existing tags after normalization', () => {
    expect(addTag(['deep-work'], '#Deep Work')).toEqual(['deep-work'])
  })

  it('caps the list at the tag limit', () => {
    expect(addTag(fullTags, 'one-more')).toEqual(fullTags)
  })

  it('still accepts the tag that fills the list', () => {
    const almostFull = fullTags.slice(0, LIMITS.tags - 1)
    expect(addTag(almostFull, 'last')).toHaveLength(LIMITS.tags)
  })

  it.each([
    ['empty input', ''],
    ['a lone hash', '#'],
    ['an overlong tag', TOO_LONG],
  ])('leaves the tags unchanged for %s', (_label, raw) => {
    expect(addTag(['one'], raw)).toEqual(['one'])
  })

  it('returns a new array and never mutates the input', () => {
    const tags = ['one'] as const
    const next = addTag(tags, 'two')
    expect(next).not.toBe(tags)
    expect(tags).toEqual(['one'])
  })

  it('keeps tags unique and within the cap for any input', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 60 }), (inputs) => {
        const tags = inputs.reduce<string[]>((acc, raw) => addTag(acc, raw), [])
        expect(new Set(tags).size).toBe(tags.length)
        expect(tags.length).toBeLessThanOrEqual(LIMITS.tags)
        expect(tags.every((tag) => normalizeTag(tag) === tag)).toBe(true)
      }),
    )
  })
})
