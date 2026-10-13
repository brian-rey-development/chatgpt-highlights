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
    })
  })
})
