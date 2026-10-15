import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
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
  makeHighlight,
  makeNewHighlight,
} from '@/testing'
import type { Route } from './router'
import {
  broadcast,
  onEvent,
  onTabCommand,
  REQUEST_TIMEOUT_MS,
  request,
  sendTabCommand,
  serve,
} from './transport'
import type { Request } from './types'

const LIST_REQUEST = { type: 'conversations.list' } as const

const READ_REQUESTS: readonly Request[] = [
  { type: 'conversation.load', conversationId: FIXTURE_CONVERSATION_ID },
  LIST_REQUEST,
  { type: 'library.snapshot' },
  { type: 'backup.export' },
]

const WRITE_REQUESTS: readonly Request[] = [
  { type: 'highlight.create', input: makeNewHighlight() },
  { type: 'highlight.update', id: 'highlight-1', patch: { note: 'later' } },
  { type: 'highlight.delete', id: 'highlight-1' },
  {
    type: 'highlight.restore',
    deleted: { highlight: makeHighlight(), conversation: makeConversation() },
  },
  {
    type: 'conversation.check',
    conversationId: FIXTURE_CONVERSATION_ID,
    outcome: { kind: 'missing' },
  },
  { type: 'conversation.purge', conversationId: FIXTURE_CONVERSATION_ID },
  { type: 'backup.import', text: '{}' },
]

const deliverFrom = async (sender: Browser.runtime.MessageSender, message: unknown) => {
  const responses: unknown[] = []
  const answered = Promise.withResolvers<void>()
  const results: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
    message,
    sender,
    (response: unknown) => {
      responses.push(response)
      answered.resolve()
    },
  )
  if (results.includes(true)) await answered.promise
  return { results, responses }
}

const deliverOwn = (message: unknown) => deliverFrom({ id: fakeBrowser.runtime.id }, message)

const routeSendsToServe = (): void => {
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(
    async (message: unknown) => (await deliverOwn(message)).responses[0],
  )
}

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
    routeSendsToServe()

    const result = await request(LIST_REQUEST)

    expect(result).toEqual(ok(conversations))
  })

  it('types the data by request type', async () => {
    serve(echoRoute([]))
    routeSendsToServe()

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

  it.each(READ_REQUESTS.map((message) => ({ name: message.type, message })))(
    'retries the read $name once after a failed send',
    async ({ message }) => {
      const background = scriptSend(new Error('worker is starting'), ok(null))

      await request(message)

      expect(background.sent()).toEqual([message, message])
    },
  )

  it.each(WRITE_REQUESTS.map((message) => ({ name: message.type, message })))(
    'sends the write $name exactly once and reports the failure',
    async ({ message }) => {
      const background = scriptSend(new Error('worker went away'), ok(null))

      const result = await request(message)

      expect(background.sent()).toEqual([message])
      expect(result).toEqual(err({ code: 'unreachable', message: 'worker went away' }))
    },
  )

  it.each(WRITE_REQUESTS.map((message) => ({ name: message.type, message })))(
    'does not resend the write $name when nobody answered',
    async ({ message }) => {
      const background = scriptSend(undefined, ok(null))

      const result = await request(message)

      expect(background.sent()).toEqual([message])
      expect(result).toMatchObject({ ok: false, error: { code: 'unreachable' } })
    },
  )

  it('does not retry an error the router answered', async () => {
    const failure = err({ code: 'not_found' as const, message: 'gone' })
    const background = scriptSend(failure)

    expect(await request(LIST_REQUEST)).toEqual(failure)
    expect(background.sent()).toEqual([LIST_REQUEST])
  })
})

describe('request deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('gives up on a read nobody answers after the deadline, once per attempt', async () => {
    const background = installFakeBackground()
    background.hold()

    const pending = request(LIST_REQUEST)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 2)

    expect(await pending).toMatchObject({ ok: false, error: { code: 'unreachable' } })
    expect(background.sent()).toEqual([LIST_REQUEST, LIST_REQUEST])
  })

  it('gives up on a write nobody answers without sending it again', async () => {
    const background = installFakeBackground()
    background.hold()
    const write = WRITE_REQUESTS[0] ?? LIST_REQUEST

    const pending = request(write)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    expect(await pending).toMatchObject({ ok: false, error: { code: 'unreachable' } })
    expect(background.sent()).toEqual([write])
  })

  it('keeps waiting until the deadline for a slow answer', async () => {
    const background = installFakeBackground()
    const gate = background.hold()

    const pending = request(LIST_REQUEST)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    gate.resolve(ok([]))

    expect(await pending).toEqual(ok([]))
    expect(background.sent()).toEqual([LIST_REQUEST])
  })
})

describe('serve', () => {
  it('answers through the response callback and keeps the channel open', async () => {
    serve(echoRoute('exported'))

    const { results, responses } = await deliverOwn({ type: 'backup.export' })

    expect(results).toEqual([true])
    expect(responses).toEqual([ok('exported')])
  })

  it.each([
    { name: 'an app event', message: FIXTURE_DATA_CHANGED },
    { name: 'a tab command', message: LIBRARY_OPEN },
  ])('ignores $name', async ({ message }) => {
    const route = vi.fn(echoRoute(null))
    serve(route)

    const { results, responses } = await deliverOwn(message)

    expect(results).not.toContain(true)
    expect(responses).toEqual([])
    expect(route).not.toHaveBeenCalled()
  })

  it('routes junk too, so the router can answer invalid_message', async () => {
    serve(echoRoute('seen'))

    const { responses } = await deliverOwn('not even an object')

    expect(responses).toEqual([ok('seen')])
  })

  it.each([
    { name: 'another extension', sender: { id: 'some-other-extension' } },
    { name: 'a sender without an id', sender: {} },
  ])('does not route a message from $name', async ({ sender }) => {
    const route = vi.fn(echoRoute('leaked'))
    serve(route)

    const { results, responses } = await deliverFrom(sender, { type: 'backup.export' })

    expect(results).not.toContain(true)
    expect(responses).toEqual([])
    expect(route).not.toHaveBeenCalled()
  })

  it('answers with an unexpected error when the route itself throws', async () => {
    serve(async () => {
      throw new Error('route exploded')
    })

    const { responses } = await deliverOwn({ type: 'backup.export' })

    expect(responses).toEqual([err({ code: 'unexpected', message: 'route exploded' })])
  })

  it('survives a response channel that already closed', async () => {
    serve(echoRoute('exported'))
    const sendResponse = vi.fn(() => {
      throw new Error('Attempting to use a disconnected port object')
    })

    const results: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
      { type: 'backup.export' },
      { id: fakeBrowser.runtime.id },
      sendResponse,
    )
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1))

    expect(results).toContain(true)
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

  it('asks for the tabs once when writes announce at the same time', async () => {
    const sent = installFakeTabs([{ id: 3 }])

    await Promise.all([
      broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH),
      broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH),
    ])

    expect(fakeBrowser.tabs.query).toHaveBeenCalledTimes(1)
    expect(sent).toHaveLength(2)
  })

  it('asks for the tabs again once the previous lookup finished', async () => {
    installFakeTabs([{ id: 3 }])

    await broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)
    await broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH)

    expect(fakeBrowser.tabs.query).toHaveBeenCalledTimes(2)
  })

  it('looks tabs up per url pattern', async () => {
    installFakeTabs([{ id: 3 }])

    await Promise.all([
      broadcast(FIXTURE_DATA_CHANGED, CHATGPT_MATCH),
      broadcast(FIXTURE_DATA_CHANGED, 'https://example.com/*'),
    ])

    expect(fakeBrowser.tabs.query).toHaveBeenCalledTimes(2)
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
