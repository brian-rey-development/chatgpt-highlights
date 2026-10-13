import { describe, expect, it } from 'vitest'
import {
  ANCHOR_MEASURE,
  APP_SLUG,
  COPIED_MESSAGE,
  JSON_MEDIA_TYPE,
  LIBRARY_LABEL,
  MOVED_TO_TRASH_MESSAGE,
  PILL_DOCK_GAP_PX,
  REMOVED_MESSAGE,
  SEARCH_LABEL,
  TRASH_LABEL,
} from './product'

describe('APP_SLUG', () => {
  it('is the lowercase hyphenated product name that also names the overlay element', () => {
    expect(APP_SLUG).toBe('chatgpt-highlights')
    expect(APP_SLUG).toMatch(/^[a-z]+(-[a-z]+)+$/)
  })
})

describe('the user-facing copy and the values end-to-end tests assert', () => {
  it.each([
    { name: 'LIBRARY_LABEL', value: LIBRARY_LABEL, expected: 'Highlights library' },
    { name: 'COPIED_MESSAGE', value: COPIED_MESSAGE, expected: 'Copied as Markdown' },
    { name: 'REMOVED_MESSAGE', value: REMOVED_MESSAGE, expected: 'Highlight removed' },
    {
      name: 'MOVED_TO_TRASH_MESSAGE',
      value: MOVED_TO_TRASH_MESSAGE,
      expected: 'Deleted chats moved to Recently deleted.',
    },
    { name: 'SEARCH_LABEL', value: SEARCH_LABEL, expected: 'Search highlights and notes' },
    { name: 'TRASH_LABEL', value: TRASH_LABEL, expected: 'Recently deleted' },
    { name: 'JSON_MEDIA_TYPE', value: JSON_MEDIA_TYPE, expected: 'application/json' },
    { name: 'ANCHOR_MEASURE', value: ANCHOR_MEASURE, expected: 'hl:anchor' },
    { name: 'PILL_DOCK_GAP_PX', value: PILL_DOCK_GAP_PX, expected: 4 },
  ])('pins $name', ({ value, expected }) => {
    expect(value).toBe(expected)
  })
})
