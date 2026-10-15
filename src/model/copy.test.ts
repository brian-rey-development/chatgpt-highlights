import { describe, expect, it } from 'vitest'
import {
  COPIED_MESSAGE,
  LIBRARY_LABEL,
  MOVED_TO_TRASH_MESSAGE,
  REMOVED_MESSAGE,
  SEARCH_LABEL,
  TEMPORARY_CHAT_MESSAGE,
  TRASH_LABEL,
} from './copy'

describe('the user-facing copy end-to-end tests assert', () => {
  it.each([
    { name: 'LIBRARY_LABEL', value: LIBRARY_LABEL, expected: 'Highlights library' },
    { name: 'COPIED_MESSAGE', value: COPIED_MESSAGE, expected: 'Copied as Markdown' },
    { name: 'REMOVED_MESSAGE', value: REMOVED_MESSAGE, expected: 'Highlight removed' },
    {
      name: 'MOVED_TO_TRASH_MESSAGE',
      value: MOVED_TO_TRASH_MESSAGE,
      expected: 'Deleted chats moved to Recently deleted.',
    },
    {
      name: 'TEMPORARY_CHAT_MESSAGE',
      value: TEMPORARY_CHAT_MESSAGE,
      expected: 'Highlights are off in temporary chats',
    },
    { name: 'SEARCH_LABEL', value: SEARCH_LABEL, expected: 'Search highlights and notes' },
    { name: 'TRASH_LABEL', value: TRASH_LABEL, expected: 'Recently deleted' },
  ])('pins $name', ({ value, expected }) => {
    expect(value).toBe(expected)
  })
})
