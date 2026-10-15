import { describe, expect, it } from 'vitest'
import { ANCHOR_MEASURE, APP_SLUG, JSON_MEDIA_TYPE, PILL_DOCK_GAP_PX } from './product'

describe('APP_SLUG', () => {
  it('is the lowercase hyphenated product name that also names the overlay element', () => {
    expect(APP_SLUG).toBe('chatgpt-highlights')
    expect(APP_SLUG).toMatch(/^[a-z]+(-[a-z]+)+$/)
  })
})

describe('the infrastructure values end-to-end tests assert', () => {
  it.each([
    { name: 'JSON_MEDIA_TYPE', value: JSON_MEDIA_TYPE, expected: 'application/json' },
    { name: 'ANCHOR_MEASURE', value: ANCHOR_MEASURE, expected: 'hl:anchor' },
    { name: 'PILL_DOCK_GAP_PX', value: PILL_DOCK_GAP_PX, expected: 4 },
  ])('pins $name', ({ value, expected }) => {
    expect(value).toBe(expected)
  })
})
