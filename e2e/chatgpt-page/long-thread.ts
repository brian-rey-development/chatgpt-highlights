import { describeQuote } from '@/anchoring'
import { serializeBackup } from '@/backup'
import { TURN_KEY_ATTR } from '@/chatgpt'
import type { Conversation, Highlight } from '@/model'
import { FIXED_TIME, makeConversation, makeHighlight } from '@/testing/factories'
import { FIXTURE_CONVERSATION_ID, HIGH_TIDE_QUOTE, LAST_ANSWER_ID } from '@/testing/fixture-ids'
import { conversationHtml } from './page'

export const LONG_CHAT_ID = '68ec1f00-0000-4000-8000-000000000099'
export const LONG_CHAT_TITLE = 'Long chat'
export const MESSAGE_COUNT = 50
export const HIGHLIGHTS_PER_MESSAGE = 2

export const FIRST_PHRASE = 'tides follow'
export const SECOND_PHRASE = 'rotation of the earth'

const TURN_OPEN = `<article ${TURN_KEY_ATTR}=`
const TURN_CLOSE = '</article>'
const TURN_KEY = new RegExp(`${TURN_KEY_ATTR}="[^"]*"`)
const LAST_ANSWER_TEXT = `${HIGH_TIDE_QUOTE} arrives about fifty minutes later each day.`

const messageIdOf = (index: number): string => `long-${index}`

const messageTextOf = (index: number): string =>
  `Message ${index}: ${FIRST_PHRASE} a regular cycle of gravitational pull and ` +
  `the ${SECOND_PHRASE}.`

const threadEnd = conversationHtml.lastIndexOf(TURN_CLOSE) + TURN_CLOSE.length

const answerTemplate = (): string => {
  const start = conversationHtml.lastIndexOf(TURN_OPEN)
  if (start < 0) throw new Error('the conversation fixture has no last answer to copy')
  return conversationHtml.slice(start, threadEnd).replace(/>\s+</g, '><')
}

const answerOf = (template: string, index: number): string =>
  template
    .replaceAll(LAST_ANSWER_ID, messageIdOf(index))
    .replace(TURN_KEY, `${TURN_KEY_ATTR}="turn-long-${index}"`)
    .replaceAll(FIXTURE_CONVERSATION_ID, LONG_CHAT_ID)
    .replace(LAST_ANSWER_TEXT, messageTextOf(index))

export const longThread = (): string => {
  const template = answerTemplate()
  const answers = Array.from({ length: MESSAGE_COUNT }, (_, index) => answerOf(template, index))
  const first = conversationHtml.indexOf(TURN_OPEN)
  return conversationHtml.slice(0, first) + answers.join('') + conversationHtml.slice(threadEnd)
}

const highlightOf = (index: number, phrase: string): Highlight => {
  const text = messageTextOf(index)
  const start = text.indexOf(phrase)
  return makeHighlight({
    id: `long-${index}-${start}`,
    conversationId: LONG_CHAT_ID,
    messageId: messageIdOf(index),
    quote: describeQuote(text, { start, end: start + phrase.length }),
  })
}

const longConversation = (): Conversation =>
  makeConversation({ id: LONG_CHAT_ID, title: LONG_CHAT_TITLE, checkedAt: Date.now() })

export const longBackup = (): string => {
  const highlights = Array.from({ length: MESSAGE_COUNT }, (_, index) => [
    highlightOf(index, FIRST_PHRASE),
    highlightOf(index, SECOND_PHRASE),
  ]).flat()
  return serializeBackup({ conversations: [longConversation()], highlights }, FIXED_TIME)
}
