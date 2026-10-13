import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import type { Request, RequestType } from '@/messaging'
import { LIMITS } from '@/model'
import { makeConversation, makeHighlight, makeNewHighlight, makeQuote } from '@/testing'
import {
  conversationSchema,
  describeIssues,
  highlightSchema,
  MAX_DATE_MS,
  parseRequest,
  requestSchema,
} from './schemas'

const input = makeNewHighlight()

describe('zod configuration', () => {
  it('runs without string evaluation, which the extension CSP forbids', () => {
    expect(z.config().jitless).toBe(true)
  })
})

const valid = [
  { type: 'conversation.load', conversationId: 'conversation-1' },
  { type: 'conversations.list' },
  {
    type: 'conversation.check',
    conversationId: 'conversation-1',
    outcome: { kind: 'exists', title: 'A chat' },
  },
  { type: 'conversation.check', conversationId: 'conversation-1', outcome: { kind: 'missing' } },
  { type: 'conversation.check', conversationId: 'conversation-1', outcome: { kind: 'unknown' } },
  { type: 'conversation.purge', conversationId: 'conversation-1' },
  { type: 'highlight.create', input },
  { type: 'highlight.update', id: 'highlight-1', patch: { color: 'pink', note: 'n', tags: ['a'] } },
  { type: 'highlight.update', id: 'highlight-1', patch: { note: '' } },
  { type: 'highlight.delete', id: 'highlight-1' },
  {
    type: 'highlight.restore',
    deleted: { highlight: makeHighlight(), conversation: makeConversation() },
  },
  { type: 'library.snapshot' },
  { type: 'backup.export' },
  { type: 'backup.import', text: '{}' },
] as const satisfies readonly Request[]

const withInput = (overrides: Record<string, unknown>): unknown => ({
  type: 'highlight.create',
  input: { ...input, ...overrides },
})

const invalid: { name: string; message: unknown }[] = [
  { name: 'a non-object', message: 'highlight.delete' },
  { name: 'null', message: null },
  { name: 'an unknown type', message: { type: 'highlight.explode', id: 'h' } },
  { name: 'a missing field', message: { type: 'highlight.delete' } },
  { name: 'an extra key', message: { type: 'highlight.delete', id: 'h', force: true } },
  { name: 'an extra key on a bare request', message: { type: 'library.snapshot', all: true } },
  { name: 'an empty id', message: { type: 'highlight.delete', id: '' } },
  { name: 'a bad color', message: withInput({ color: 'red' }) },
  { name: 'an over-limit note', message: withInput({ note: 'n'.repeat(LIMITS.noteChars + 1) }) },
  {
    name: 'an over-limit quote',
    message: withInput({ quote: makeQuote({ exact: 'q'.repeat(LIMITS.quoteChars + 1) }) }),
  },
  { name: 'an empty quote', message: withInput({ quote: makeQuote({ exact: '' }) }) },
  {
    name: 'an over-limit context',
    message: withInput({ quote: makeQuote({ prefix: 'p'.repeat(LIMITS.contextChars + 1) }) }),
  },
  {
    name: 'a quote that ends before it starts',
    message: withInput({ quote: makeQuote({ start: 10, end: 5 }) }),
  },
  { name: 'a negative offset', message: withInput({ quote: makeQuote({ start: -1 }) }) },
  { name: 'an extra key on the input', message: withInput({ extra: 1 }) },
  { name: 'an empty patch', message: { type: 'highlight.update', id: 'h', patch: {} } },
  {
    name: 'a patch with only undefined values',
    message: { type: 'highlight.update', id: 'h', patch: { note: undefined } },
  },
  {
    name: 'an extra key in the patch',
    message: { type: 'highlight.update', id: 'h', patch: { note: 'n', id: 'x' } },
  },
  {
    name: 'too many tags',
    message: {
      type: 'highlight.update',
      id: 'h',
      patch: { tags: Array.from({ length: LIMITS.tags + 1 }, (_, index) => `t${index}`) },
    },
  },
  {
    name: 'an over-long tag',
    message: {
      type: 'highlight.update',
      id: 'h',
      patch: { tags: ['t'.repeat(LIMITS.tagChars + 1)] },
    },
  },
  {
    name: 'a tag that is not normalized',
    message: { type: 'highlight.update', id: 'h', patch: { tags: ['Deep Work'] } },
  },
  {
    name: 'a repeated tag',
    message: { type: 'highlight.update', id: 'h', patch: { tags: ['a', 'a'] } },
  },
  {
    name: 'a restore whose highlight belongs to another chat',
    message: {
      type: 'highlight.restore',
      deleted: {
        highlight: makeHighlight({ conversationId: 'other' }),
        conversation: makeConversation(),
      },
    },
  },
  {
    name: 'an unknown outcome kind',
    message: { type: 'conversation.check', conversationId: 'c', outcome: { kind: 'gone' } },
  },
  {
    name: 'an exists outcome without a title',
    message: { type: 'conversation.check', conversationId: 'c', outcome: { kind: 'exists' } },
  },
  { name: 'a non-string backup text', message: { type: 'backup.import', text: 5 } },
]

describe('requestSchema', () => {
  it('covers every request type', () => {
    expectTypeOf<(typeof valid)[number]['type']>().toEqualTypeOf<RequestType>()
  })

  it.each(valid.map((message) => ({ name: message.type, message })))(
    'accepts a valid $name request',
    ({ message }) => {
      expect(requestSchema.parse(message)).toEqual(message)
    },
  )

  it.each(invalid)('rejects $name', ({ message }) => {
    expect(requestSchema.safeParse(message).success).toBe(false)
  })
})

describe('entity schemas', () => {
  it('accepts a highlight and a conversation', () => {
    expect(highlightSchema.parse(makeHighlight())).toEqual(makeHighlight())
    expect(conversationSchema.parse(makeConversation())).toEqual(makeConversation())
  })

  it('accepts a timestamp at the edge of the date range', () => {
    const highlight = makeHighlight({ createdAt: MAX_DATE_MS })
    expect(highlightSchema.parse(highlight)).toEqual(highlight)
  })

  it('accepts a trashed conversation with its trash time', () => {
    const trashed = makeConversation({ status: 'trashed', trashedAt: 5 })
    expect(conversationSchema.parse(trashed)).toEqual(trashed)
  })

  it.each([
    { name: 'a fractional timestamp', value: makeHighlight({ createdAt: 1.5 }) },
    { name: 'a missing conversation id', value: { ...makeHighlight(), conversationId: undefined } },
    { name: 'an extra key', value: { ...makeHighlight(), extra: true } },
    {
      name: 'a timestamp past the date range',
      value: makeHighlight({ createdAt: MAX_DATE_MS + 1 }),
    },
  ])('rejects a highlight with $name', ({ value }) => {
    expect(highlightSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    { name: 'an unknown status', value: { ...makeConversation(), status: 'archived' } },
    { name: 'a string trash time', value: { ...makeConversation(), trashedAt: 'now' } },
    {
      name: 'a trashed status without a trash time',
      value: makeConversation({ status: 'trashed' }),
    },
    { name: 'a trash time on an active chat', value: makeConversation({ trashedAt: 5 }) },
  ])('rejects a conversation with $name', ({ value }) => {
    expect(conversationSchema.safeParse(value).success).toBe(false)
  })
})

describe('parseRequest', () => {
  it('returns the parsed request on success', () => {
    expect(parseRequest({ type: 'library.snapshot' })).toEqual({
      ok: true,
      data: { type: 'library.snapshot' },
    })
  })

  it('returns an invalid_message error with a readable message', () => {
    const result = parseRequest({ type: 'highlight.update', id: 'h', patch: { color: 'red' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid_message')
    expect(result.error.message).toContain('patch')
  })

  it('never throws on hostile input', () => {
    expect(parseRequest(undefined).ok).toBe(false)
  })
})

describe('describeIssues', () => {
  it('names the path of each issue and joins them', () => {
    const result = highlightSchema.safeParse({ ...makeHighlight(), color: 'red', note: 5 })
    if (result.success) throw new Error('expected a failure')
    const text = describeIssues(result.error)
    expect(text).toContain('color')
    expect(text).toContain('note')
    expect(text).toContain('; ')
  })

  it('describes a root-level issue without a path', () => {
    const result = highlightSchema.safeParse(null)
    if (result.success) throw new Error('expected a failure')
    expect(describeIssues(result.error)).toMatch(/^Invalid input/)
  })
})
