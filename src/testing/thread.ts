import { describeQuote, rangeOfSpan, readMessageText } from '@/anchoring'
import {
  COMPOSER_FORM,
  findUnit,
  IGNORED_TEXT_SELECTOR,
  MESSAGE_ID_ATTR,
  MESSAGE_UNIT,
  type MessageUnit,
  mainPane,
  STOP_BUTTON_TEST_ID,
  TEST_ID_ATTR,
  TURN,
} from '@/chatgpt'
import type { AppEvent, TabCommand } from '@/messaging'
import type { ConversationHighlights, Highlight, Snapshot } from '@/model'
import { cloneElement, requireElement } from './dom'
import { makeHighlight } from './factories'
import { FIXTURE_CONVERSATION_ID } from './fixture-ids'

export const EMPTY_SNAPSHOT: Snapshot = { conversations: [], highlights: [] }
export const EMPTY_LOAD: ConversationHighlights = { conversation: null, highlights: [] }
export const LIBRARY_OPEN: TabCommand = { type: 'library.open' }

export const dataChanged = (...conversationIds: string[]): AppEvent => ({
  type: 'data.changed',
  conversationIds,
})

export const FIXTURE_DATA_CHANGED = dataChanged(FIXTURE_CONVERSATION_ID)

const ANSWERED_TURN = `${TURN}:has(${MESSAGE_UNIT})`

export const threadContainer = (): Element => requireElement(`:has(> ${TURN})`)

export const requireUnit = (messageId: string): MessageUnit => {
  const unit = findUnit(document, messageId)
  if (!unit) throw new Error(`fixture has no unit ${messageId}`)
  return unit
}

export const highlightIn = (
  messageId: string,
  exact: string,
  overrides: Partial<Highlight> = {},
): Highlight => {
  const { text } = readMessageText(requireUnit(messageId).textRoot, IGNORED_TEXT_SELECTOR)
  const start = text.indexOf(exact)
  const quote = describeQuote(text, { start, end: start + exact.length })
  return makeHighlight({
    id: `${messageId}-${exact}`,
    conversationId: FIXTURE_CONVERSATION_ID,
    messageId,
    quote,
    ...overrides,
  })
}

export const rangeOfQuote = (messageId: string, exact: string): Range => {
  const message = readMessageText(requireUnit(messageId).textRoot, IGNORED_TEXT_SELECTOR)
  const start = message.text.indexOf(exact)
  const range = rangeOfSpan(message, { start, end: start + exact.length })
  if (!range) throw new Error(`fixture message ${messageId} has no ${exact}`)
  return range
}

export const appendAnsweredTurn = (messageId: string): Element => {
  const turn = cloneElement(requireElement(ANSWERED_TURN))
  requireElement(MESSAGE_UNIT, turn).setAttribute(MESSAGE_ID_ATTR, messageId)
  threadContainer().append(turn)
  return requireElement(MESSAGE_UNIT, turn)
}

export const addStopButton = (root: ParentNode = document): Element => {
  const button = document.createElement('button')
  button.setAttribute(TEST_ID_ATTR, STOP_BUTTON_TEST_ID)
  requireElement(COMPOSER_FORM, root).append(button)
  return button
}

export interface SwappedMains {
  hidden: HTMLElement
  visible: HTMLElement
}

export const swapMain = (html: string): SwappedMains => {
  const hidden = mainPane(document)
  if (!hidden) throw new Error('fixture has no visible main')
  hidden.hidden = true
  hidden.insertAdjacentHTML('afterend', html)
  const visible = hidden.nextElementSibling
  if (!(visible instanceof HTMLElement)) throw new Error('swapped html has no main')
  return { hidden, visible }
}
