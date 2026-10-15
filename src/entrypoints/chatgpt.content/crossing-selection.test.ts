import { beforeEach, describe, expect, it } from 'vitest'
import { COMPOSER } from '@/chatgpt'
import {
  conversationHtml,
  FIRST_ANSWER_ID,
  LAST_ANSWER_ID,
  mountFixture,
  PULL_QUOTE,
  rangeOfQuote,
  rangeOver,
  requireElement,
  requireUnit,
  selectRange,
} from '@/testing'
import { crossesMessages } from './crossing-selection'

const acrossTwoMessages = (): Range => {
  const range = rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot)
  range.setEnd(requireUnit(LAST_ANSWER_ID).textRoot, 1)
  return range
}

beforeEach(() => {
  mountFixture(conversationHtml)
})

describe('crossesMessages', () => {
  it('is true for a selection that starts in one message and ends in another', () => {
    selectRange(acrossTwoMessages())
    expect(crossesMessages(document)).toBe(true)
  })

  it('is true for a selection that starts in a message and ends outside every message', () => {
    const range = rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot)
    range.setEnd(requireElement(COMPOSER), 0)
    selectRange(range)
    expect(crossesMessages(document)).toBe(true)
  })

  it('is false for a selection inside one message', () => {
    selectRange(rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE))
    expect(crossesMessages(document)).toBe(false)
  })

  it('is false for a selection that starts outside every message', () => {
    selectRange(rangeOver(requireElement(COMPOSER)))
    expect(crossesMessages(document)).toBe(false)
  })

  it('is false for a collapsed selection', () => {
    const range = acrossTwoMessages()
    range.collapse(true)
    selectRange(range)
    expect(crossesMessages(document)).toBe(false)
  })

  it('is false when nothing is selected', () => {
    document.getSelection()?.removeAllRanges()
    expect(crossesMessages(document)).toBe(false)
  })
})
