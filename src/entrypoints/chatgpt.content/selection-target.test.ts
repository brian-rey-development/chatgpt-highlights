import { beforeEach, describe, expect, it } from 'vitest'
import { COMPOSER, TEXT_ROOT } from '@/chatgpt'
import { LIMITS } from '@/model'
import {
  conversationHtml,
  FIRST_ANSWER_ID,
  HIGH_TIDE_QUOTE,
  LAST_ANSWER_ID,
  mountFixture,
  PULL_QUOTE,
  rangeOfQuote,
  rangeOver,
  requireElement,
  requireUnit,
  selectRange,
} from '@/testing'
import { selectionTarget } from './selection-target'

const FIRST_PARAGRAPH = `${TEXT_ROOT} p`

const selectQuote = (messageId: string, exact: string): void =>
  selectRange(rangeOfQuote(messageId, exact))

beforeEach(() => {
  mountFixture(conversationHtml)
})

describe('selectionTarget', () => {
  it('describes a selection inside one message text root', () => {
    selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    const target = selectionTarget(document)
    expect(target?.unit.messageId).toBe(FIRST_ANSWER_ID)
    expect(target?.message.text.slice(target.span.start, target.span.end)).toBe(PULL_QUOTE)
  })

  it('has no target while nothing is selected', () => {
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for a collapsed selection', () => {
    const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    range.collapse(true)
    selectRange(range)
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for a selection that crosses two messages', () => {
    const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    range.setEnd(requireUnit(LAST_ANSWER_ID).textRoot, 1)
    selectRange(range)
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for a selection that runs past its message into the composer', () => {
    const draft = requireElement(`${COMPOSER} p`)
    draft.textContent = 'my next question'
    const range = rangeOfQuote(LAST_ANSWER_ID, HIGH_TIDE_QUOTE)
    range.setEndAfter(draft)
    selectRange(range)
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for a selection that ends inside the next message', () => {
    const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    const nextText = requireUnit(LAST_ANSWER_ID).textRoot
    range.setEndAfter(nextText.firstElementChild ?? nextText)
    selectRange(range)
    expect(selectionTarget(document)).toBeNull()
  })

  it('accepts a selection that ends in chrome with nothing visible after the text', () => {
    const chrome = document.createElement('button')
    chrome.textContent = 'Copy'
    requireUnit(FIRST_ANSWER_ID).textRoot.after(chrome)
    const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    range.setEndAfter(chrome)
    selectRange(range)
    expect(selectionTarget(document)?.unit.messageId).toBe(FIRST_ANSWER_ID)
  })

  it('has no target for a selection inside the composer', () => {
    selectRange(rangeOver(requireElement(COMPOSER)))
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for a selection that starts in the message but outside its text root', () => {
    const actions = document.createElement('div')
    actions.textContent = 'Copy Share'
    requireUnit(FIRST_ANSWER_ID).element.append(actions)
    selectRange(rangeOver(actions))
    expect(selectionTarget(document)).toBeNull()
  })

  it('has no target for text that is only whitespace', () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    paragraph.append(' ')
    const range = document.createRange()
    range.selectNodeContents(paragraph.lastChild ?? paragraph)
    selectRange(range)
    expect(selectionTarget(document)).toBeNull()
  })

  it('accepts a triple click that ends at the start of the next element', () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    const range = document.createRange()
    range.setStart(paragraph, 0)
    range.setEnd(requireElement('ul'), 0)
    selectRange(range)
    const target = selectionTarget(document)
    expect(target?.message.text.slice(target.span.start, target.span.end)).toBe(
      paragraph.textContent,
    )
  })

  it('accepts a selection of exactly the size limit and rejects one character more', () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    paragraph.textContent = 'x'.repeat(LIMITS.quoteChars)
    selectRange(rangeOver(paragraph))
    expect(selectionTarget(document)).not.toBeNull()
    paragraph.textContent = 'x'.repeat(LIMITS.quoteChars + 1)
    selectRange(rangeOver(paragraph))
    expect(selectionTarget(document)).toBeNull()
  })
})
