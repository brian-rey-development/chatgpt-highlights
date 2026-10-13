import { describe, expect, it } from 'vitest'
import { FIXTURE_CONVERSATION_ID } from '@/testing'
import {
  CHATGPT_MATCH,
  CHATGPT_ORIGIN,
  conversationIdFromPath,
  conversationUrl,
  isTemporaryChat,
  LIBRARY_ADDRESS,
  LIBRARY_HASH,
  LIBRARY_URL,
  TEMPORARY_CHAT_PARAM,
} from './url'

describe('conversationIdFromPath', () => {
  it.each([
    {
      name: 'plain chat',
      path: `/c/${FIXTURE_CONVERSATION_ID}`,
      expected: FIXTURE_CONVERSATION_ID,
    },
    {
      name: 'gpt chat',
      path: `/g/g-abc123/c/${FIXTURE_CONVERSATION_ID}`,
      expected: FIXTURE_CONVERSATION_ID,
    },
    {
      name: 'project chat',
      path: `/project/p-1/c/${FIXTURE_CONVERSATION_ID}`,
      expected: FIXTURE_CONVERSATION_ID,
    },
    {
      name: 'trailing slash',
      path: `/c/${FIXTURE_CONVERSATION_ID}/`,
      expected: FIXTURE_CONVERSATION_ID,
    },
    {
      name: 'uppercase id',
      path: `/c/${FIXTURE_CONVERSATION_ID.toUpperCase()}`,
      expected: FIXTURE_CONVERSATION_ID,
    },
    { name: 'home', path: '/', expected: null },
    { name: 'library', path: '/library', expected: null },
    { name: 'malformed id', path: '/c/nope', expected: null },
    { name: 'extra segment', path: `/c/${FIXTURE_CONVERSATION_ID}/share`, expected: null },
    { name: 'id outside a chat route', path: `/x/${FIXTURE_CONVERSATION_ID}`, expected: null },
  ])('$name', ({ path, expected }) => {
    expect(conversationIdFromPath(path)).toBe(expected)
  })
})

describe('urls', () => {
  it('builds a conversation url on the chatgpt origin', () => {
    expect(conversationUrl(FIXTURE_CONVERSATION_ID)).toBe(
      `${CHATGPT_ORIGIN}/c/${FIXTURE_CONVERSATION_ID}`,
    )
  })

  it('exposes the match pattern and library hash', () => {
    expect(CHATGPT_MATCH).toBe('https://chatgpt.com/*')
    expect(LIBRARY_HASH).toBe('#highlights')
  })

  it('addresses the library as the chatgpt home with the library hash', () => {
    expect(LIBRARY_ADDRESS).toBe('/#highlights')
    expect(LIBRARY_URL).toBe(`${CHATGPT_ORIGIN}${LIBRARY_ADDRESS}`)
    expect(new URL(LIBRARY_URL).hash).toBe(LIBRARY_HASH)
  })
})

describe('isTemporaryChat', () => {
  it.each([
    { name: 'flag on', search: '?temporary-chat=true', expected: true },
    { name: 'flag among other params', search: '?model=x&temporary-chat=true&a=b', expected: true },
    { name: 'no query', search: '', expected: false },
    { name: 'other params only', search: '?model=x', expected: false },
    { name: 'flag off', search: '?temporary-chat=false', expected: false },
    { name: 'flag without value', search: '?temporary-chat', expected: false },
    { name: 'flag value in another case', search: '?temporary-chat=TRUE', expected: false },
  ])('$name', ({ search, expected }) => {
    expect(isTemporaryChat(search)).toBe(expected)
  })

  it('names the param ChatGPT puts on temporary chats', () => {
    expect(TEMPORARY_CHAT_PARAM).toBe('temporary-chat')
  })
})
