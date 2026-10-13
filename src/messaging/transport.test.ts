import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { err, ok, type Result } from '@/errors'
import type { Conversation } from '@/model'
import {
  CHATGPT_MATCH,
  deliverMessage,
  FIXTURE_CONVERSATION_ID,
  FIXTURE_DATA_CHANGED,
  installFakeBackground,
  installFakeTabs,
  LIBRARY_OPEN,
  makeConversation,
} from '@/testing'
import type { Route } from './router'
import { broadcast, onEvent, onTabCommand, request, sendTabCommand, serve } from './transport'

const LIST_REQUEST = { type: 'conversations.list' } as const

const echoRoute =
  (data: unknown): Route =>
  async () =>
    ok(data)

const scriptSend = (...outcomes: unknown[]) => {
  const remaining = [...outcomes]
  const background = installFakeBackground()
  background.answerWith(() => {
    const outcome = remaining.length > 1 ? remaining.shift() : remaining[0]
    if (outcome instanceof Error) throw outcome
    return outcome
  })
  return background
}

describe('request', () => {
  it('returns what the served router answers', async () => {
    const conversations = [makeConversation()]
    serve(echoRoute(conversations))

    const result = await request(LIST_REQUEST)

    expect(result).toEqual(ok(conversations))
  })

  it('types the data by request type', async () => {
    serve(echoRoute([]))

    const result = await request(LIST_REQUEST)

    expectTypeOf(result).toEqualTypeOf<Result<Conversation[]>>()
  })

  it('retries once when the first send throws', async () => {
    const background = scriptSend(new Error('worker is starting'), ok([]))

    expect(await request(LIST_REQUEST)).toEqual(ok([]))
    expect(background.sent()).toEqual([LIST_REQUEST, LIST_REQUEST])
  })

  it('retries once when nobody answers the first send', async () => {
    scriptSend(undefined, ok([]))

    expect(await request(LIST_REQUEST)).toEqual(ok([]))
  })

  it('returns unreachable with the reason after two failed sends', async () => {
    const background = scriptSend(new Error('Receiving end does not exist'))

    const result = await request(LIST_REQUEST)

    expect(result).toEqual(err({ code: 'unreachable', message: 'Receiving end does not exist' }))
    expect(background.sent()).toEqual([LIST_REQUEST, LIST_REQUEST])
  })

  it('returns unreachable when no listener is registered at all', async () => {
    const result = await request(LIST_REQUEST)

    expect(result).toMatchObject({ ok: false, error: { code: 'unreachable' } })
  })

  it('treats an answer that is not a Result as no answer', async () => {
    scriptSend({ unexpected: 'shape' })

    const result = await request(LIST_REQUEST)

    expect(result).toMatchObject({ ok: false, error: { code: 'unreachable' } })
  })

  it('treats a failure without an error code as no answer', async () => {
    scriptSend({ ok: false, error: {} })

    const result = await request(LIST_REQUEST)

    expect(result).toMatchObject({ ok: false, error: { code: 'unreachable' } })
  })

  it('does not retry an error the router answered', async () => {
    const failure = err({ code: 'not_found' as const, message: 'gone' })
    const background = scriptSend(failure)

    expect(await request(LIST_REQUEST)).toEqual(failure)
    expect(background.sent()).toEqual([LIST_REQUEST])
  })
})

describe('serve', () => {
  it('answers through the response callback and keeps the channel open', async () => {
    serve(echoRoute('exported'))

    const { results, responses } = await deliverMessage({ type: 'backup.export' })

    expect(results).toEqual([true])
    expect(responses).toEqual([ok('exported')])
  })

  it.each([
    { name: 'an app event', message: FIXTURE_DATA_CHANGED },
    { name: 'a tab command', message: LIBRARY_OPEN },
  ])('ignores $name', async ({ message }) => {
    const route = vi.fn(echoRoute(null))
    serve(route)

    const { results, responses } = await deliverMessage(message)

    expect(results).not.toContain(true)
    expect(responses).toEqual([])
    expect(route).not.toHaveBeenCalled()
  })

  it('routes junk too, so the router can answer invalid_message', async () => {
    serve(echoRoute('seen'))

    const { responses } = await deliverMessage('not even an object')

    expect(responses).toEqual([ok('seen')])
  })

  it('stops answering after the returned unsubscribe runs', async () => {
    const stop = serve(echoRoute('exported'))

    stop()

    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(false)
  })
})

describe('broadcast', () => {
  it('sends the event to every tab matching the url pattern', async () => {
    const sent = installFakeTabs([{ id: 3 }, { id: 4 }])

    await broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)

    expect(fakeBrowser.tabs.query).toHaveBeenCalledWith({ url: CHATGPT_MATCH })
    expect(sent).toEqual([
      { tabId: 3, message: FIXTURE_DATA_CHANGED },
      { tabId: 4, message: FIXTURE_DATA_CHANGED },
    ])
  })

  it('keeps delivering and resolves when one tab fails', async () => {
    const sent = installFakeTabs([{ id: 3 }, { id: 4, unreachable: true }, { id: 5 }])

    await expect(broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)).resolves.toBeUndefined()
    expect(sent.map(({ tabId }) => tabId)).toEqual([3, 5])
  })

  it('skips tabs that have no id', async () => {
    const sent = installFakeTabs([{ id: undefined }, { id: 7 }])

    await broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)

    expect(sent.map(({ tabId }) => tabId)).toEqual([7])
  })

  it('resolves when the tabs cannot be listed', async () => {
    const sent = installFakeTabs([{ id: 3 }])
    vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValue(new Error('tabs gone'))

    await expect(broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)).resolves.toBeUndefined()
    expect(sent).toEqual([])
  })

  it('resolves when no tab matches', async () => {
    installFakeTabs([])

    await expect(broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)).resolves.toBeUndefined()
  })
})

describe('sendTabCommand', () => {
  it('sends the command to the given tab', async () => {
    const sent = installFakeTabs([{ id: 9 }])

    await sendTabCommand(9, LIBRARY_OPEN)

    expect(sent).toEqual([{ tabId: 9, message: LIBRARY_OPEN }])
  })
})

interface ListenerCase {
  name: string
  listen: (listener: (message: unknown) => void) => () => void
  accepted: unknown
  ignored: readonly { name: string; message: unknown }[]
}

const LISTENER_CASES: readonly ListenerCase[] = [
  {
    name: 'onEvent',
    listen: onEvent,
    accepted: FIXTURE_DATA_CHANGED,
    ignored: [
      { name: 'a request', message: LIST_REQUEST },
      { name: 'a tab command', message: LIBRARY_OPEN },
      { name: 'junk', message: 'data.changed' },
      { name: 'an event without conversation ids', message: { type: 'data.changed' } },
      {
        name: 'an event whose conversation ids are not a list',
        message: { type: 'data.changed', conversationIds: FIXTURE_CONVERSATION_ID },
      },
      {
        name: 'an event with a conversation id that is not a string',
        message: { type: 'data.changed', conversationIds: [FIXTURE_CONVERSATION_ID, 7] },
      },
      { name: 'null', message: null },
    ],
  },
  {
    name: 'onTabCommand',
    listen: onTabCommand,
    accepted: LIBRARY_OPEN,
    ignored: [
      { name: 'a request', message: LIST_REQUEST },
      { name: 'an app event', message: FIXTURE_DATA_CHANGED },
      { name: 'junk', message: 42 },
    ],
  },
]

describe.each(LISTENER_CASES)('$name', ({ listen, accepted, ignored }) => {
  it('passes its messages to the listener and acknowledges them', async () => {
    const received: unknown[] = []
    listen((message) => received.push(message))

    const { responses } = await deliverMessage(accepted)

    expect(received).toEqual([accepted])
    expect(responses).toEqual([null])
  })

  it.each(ignored)('ignores $name', async ({ message }) => {
    const listener = vi.fn()
    listen(listener)

    const { responses } = await deliverMessage(message)

    expect(responses).toEqual([])
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops listening after the returned unsubscribe runs', () => {
    const stop = listen(vi.fn())

    stop()

    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(false)
  })
})
