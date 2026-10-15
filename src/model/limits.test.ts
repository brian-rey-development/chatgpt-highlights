import { describe, expect, it } from 'vitest'
import { LIMITS } from './limits'

describe('limits', () => {
  it('pins the caps from the data model', () => {
    expect(LIMITS).toEqual({
      quoteChars: 5000,
      noteChars: 5000,
      tags: 20,
      tagChars: 40,
      contextChars: 32,
      idChars: 200,
      titleChars: 2000,
      messageChars: 10_000_000,
      backupChars: 67_108_864,
      backupConversations: 10_000,
      backupHighlights: 50_000,
    })
  })
})
