import { describe, expect, it } from 'vitest'
import { AppFailure, err, ok } from '@/errors'
import { makeConversation, makeHighlight } from '@/testing'
import { createRouter } from './router'
import type { Handlers, Request } from './types'

const notExpected = async (): Promise<never> => {
  throw new AppFailure('unexpected', 'handler should not run')
}

const baseHandlers: Handlers = {
  'conversation.load': notExpected,
  'conversations.list': notExpected,
  'conversation.check': notExpected,
  'conversation.purge': notExpected,
  'highlight.create': notExpected,
  'highlight.update': notExpected,
  'highlight.delete': notExpected,
  'highlight.restore': notExpected,
  'library.snapshot': notExpected,
  'backup.export': notExpected,
  'backup.import': notExpected,
}

const parseAs = (request: Request) => () => ok(request)
const badShape = () => err({ code: 'invalid_message' as const, message: 'bad shape' })

describe('createRouter', () => {
  it('answers a valid request with the handler result', async () => {
    const conversations = [makeConversation()]
    const route = createRouter(parseAs({ type: 'conversations.list' }), {
      ...baseHandlers,
      'conversations.list': async () => conversations,
    })

    expect(await route({})).toEqual(ok(conversations))
  })

  it('hands the handler the parsed request, not the raw message', async () => {
    const route = createRouter(parseAs({ type: 'highlight.delete', id: 'h1' }), {
      ...baseHandlers,
      'highlight.delete': async ({ id }) => ({
        highlight: makeHighlight({ id }),
        conversation: makeConversation(),
      }),
    })

    const result = await route('raw junk')

    expect(result.ok && result.data).toMatchObject({ highlight: { id: 'h1' } })
  })

  it('keeps a null handler result as a successful answer', async () => {
    const route = createRouter(parseAs({ type: 'conversation.purge', conversationId: 'c1' }), {
      ...baseHandlers,
      'conversation.purge': async () => null,
    })

    expect(await route({})).toEqual(ok(null))
  })

  it('answers invalid_message and skips every handler when parsing fails', async () => {
    const route = createRouter(badShape, baseHandlers)

    expect(await route({ type: 'nope' })).toEqual(
      err({ code: 'invalid_message', message: 'bad shape' }),
    )
  })

  it('reports invalid_message even when the parser used another code', async () => {
    const route = createRouter(
      () => err({ code: 'unexpected', message: 'schema blew up' }),
      baseHandlers,
    )

    expect(await route(null)).toEqual(err({ code: 'invalid_message', message: 'schema blew up' }))
  })

  it('answers with the code of an AppFailure thrown by a handler', async () => {
    const route = createRouter(parseAs({ type: 'library.snapshot' }), {
      ...baseHandlers,
      'library.snapshot': async () => {
        throw new AppFailure('not_found', 'no such highlight')
      },
    })

    expect(await route({})).toEqual(err({ code: 'not_found', message: 'no such highlight' }))
  })

  it('answers unexpected for any other error a handler throws', async () => {
    const route = createRouter(parseAs({ type: 'backup.export' }), {
      ...baseHandlers,
      'backup.export': async () => {
        throw new TypeError('db closed')
      },
    })

    expect(await route({})).toEqual(err({ code: 'unexpected', message: 'db closed' }))
  })

  it('answers unexpected when a handler throws before returning a promise', async () => {
    const route = createRouter(parseAs({ type: 'backup.export' }), {
      ...baseHandlers,
      'backup.export': () => {
        throw new Error('sync failure')
      },
    })

    expect(await route({})).toEqual(err({ code: 'unexpected', message: 'sync failure' }))
  })
})
