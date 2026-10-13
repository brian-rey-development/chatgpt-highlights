import { beforeEach, describe, expect, it } from 'vitest'
import { MESSAGE_ID_ATTR, MESSAGE_UNIT, mainPane, TURN } from '@/chatgpt'
import { requireElement } from './dom'
import {
  FIRST_ANSWER_ID,
  FIXTURE_CONVERSATION_ID,
  LAST_ANSWER_ID,
  NEW_ANSWER_ID,
  PULL_QUOTE,
} from './fixture-ids'
import { conversationHtml, homeHtml, mountFixture } from './fixtures'
import {
  appendAnsweredTurn,
  highlightIn,
  rangeOfQuote,
  requireUnit,
  swapMain,
  threadContainer,
} from './thread'

beforeEach(() => mountFixture(conversationHtml))

describe('threadContainer', () => {
  it('returns the element that holds the turns', () => {
    expect(threadContainer()).toBe(requireElement(TURN).parentElement)
  })

  it('throws when the page has no turns', () => {
    mountFixture('<main></main>')
    expect(() => threadContainer()).toThrow('fixture has no')
  })
})

describe('requireUnit', () => {
  it('returns the unit of a mounted message', () => {
    expect(requireUnit(LAST_ANSWER_ID).messageId).toBe(LAST_ANSWER_ID)
  })

  it('throws for a message the fixture lacks', () => {
    expect(() => requireUnit('ghost')).toThrow('fixture has no unit ghost')
  })
})

describe('highlightIn', () => {
  it('describes the quote inside the message text', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { color: 'green' })
    expect(highlight).toMatchObject({
      id: `${FIRST_ANSWER_ID}-${PULL_QUOTE}`,
      conversationId: FIXTURE_CONVERSATION_ID,
      messageId: FIRST_ANSWER_ID,
      color: 'green',
    })
    expect(highlight.quote.exact).toBe(PULL_QUOTE)
  })
})

describe('rangeOfQuote', () => {
  it('spans exactly the quoted text of the message', () => {
    expect(rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE).toString()).toBe(PULL_QUOTE)
  })

  it('throws when the message does not contain the text', () => {
    expect(() => rangeOfQuote(FIRST_ANSWER_ID, 'no such passage')).toThrow(
      `fixture message ${FIRST_ANSWER_ID} has no no such passage`,
    )
  })
})

describe('appendAnsweredTurn', () => {
  it('mounts a copy of an answered turn under a new message id', () => {
    const unit = appendAnsweredTurn(NEW_ANSWER_ID)
    expect(unit.getAttribute(MESSAGE_ID_ATTR)).toBe(NEW_ANSWER_ID)
    expect(document.querySelectorAll(MESSAGE_UNIT)).toHaveLength(3)
    expect(unit.closest(TURN)?.parentElement).toBe(threadContainer())
  })
})

describe('swapMain', () => {
  it('hides the visible main and mounts the given one after it', () => {
    const { hidden, visible } = swapMain(homeHtml)
    expect(hidden.hidden).toBe(true)
    expect(visible).toBe(hidden.nextElementSibling)
    expect(mainPane(document)).toBe(visible)
  })

  it('hides the main that is visible at that moment', () => {
    const first = swapMain(homeHtml)
    const second = swapMain(conversationHtml)
    expect(second.hidden).toBe(first.visible)
    expect(first.visible.hidden).toBe(true)
  })

  it('throws without a visible main', () => {
    mountFixture('<main hidden></main>')
    expect(() => swapMain(homeHtml)).toThrow('fixture has no visible main')
  })

  it('throws when the swapped html is not an element', () => {
    expect(() => swapMain('text only')).toThrow('swapped html has no main')
  })
})
