import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/errors'
import { fieldOf, MOVED_TO_TRASH_MESSAGE } from '@/model'
import { createPainter } from '@/painter'
import { CHECK_INTERVAL_MS } from '@/retention'
import {
  EMPTY_SNAPSHOT,
  type FakeBackground,
  type FakeChatGptApi,
  FIXED_TIME,
  installFakeBackground,
  installFakeChatGptApi,
  installFakeHighlightApi,
  makeConversation,
  makeOverlayRoot,
  OFFLINE_FAILURE,
  settle,
  WRITE_FAILURE,
} from '@/testing'
import type { Stop } from './listen'
import { MAX_IN_FLIGHT, startStatusChecks } from './status-checks'
import { createStore, type Store } from './store'

const NOW = FIXED_TIME + 2 * CHECK_INTERVAL_MS
const STALE = FIXED_TIME

let store: Store
let background: FakeBackground
let api: FakeChatGptApi
const stops: Stop[] = []

const stale = (id: string, overrides = {}) =>
  makeConversation({ id, checkedAt: STALE, ...overrides })

const begin = (): void => {
  const runtime = {
    doc: document,
    store,
    painter: createPainter(installFakeHighlightApi()),
    shadowRoot: makeOverlayRoot(),
  }
  stops.push(startStatusChecks(runtime))
}

const openLibrary = async (): Promise<void> => {
  store.library.value = { snapshot: EMPTY_SNAPSHOT, now: NOW }
  await settle()
}

const closeLibrary = (): void => {
  store.library.value = null
}

const serve = (conversations: ReturnType<typeof stale>[]): void => {
  background.answerWith((message) => {
    switch (fieldOf(message, 'type')) {
      case 'conversations.list':
        return ok(conversations)
      case 'conversation.check':
        return ok(
          conversations.find(
            (conversation) => conversation.id === fieldOf(message, 'conversationId'),
          ),
        )
      default:
        return err({ code: 'invalid_message', message: 'unexpected' })
    }
  })
}

const checkMessages = (): unknown[] => background.sent('conversation.check')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  store = createStore()
  background = installFakeBackground()
  api = installFakeChatGptApi()
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('when a pass runs', () => {
  it('runs one pass each time the library goes from closed to open', async () => {
    serve([stale('a')])
    begin()
    expect(background.sent()).toEqual([])
    await openLibrary()
    expect(api.checked()).toEqual(['a'])
    store.library.value = { snapshot: EMPTY_SNAPSHOT, now: NOW + 1 }
    await settle()
    expect(api.checked()).toEqual(['a'])
    closeLibrary()
    await openLibrary()
    expect(api.checked()).toEqual(['a', 'a'])
  })

  it('does nothing while the library stays closed', async () => {
    serve([stale('a')])
    begin()
    closeLibrary()
    await settle()
    expect(background.sent()).toEqual([])
    expect(api.sessionRequests()).toBe(0)
  })

  it('starts a pass for a library that is already open', async () => {
    serve([stale('a')])
    store.library.value = { snapshot: EMPTY_SNAPSHOT, now: NOW }
    begin()
    await settle()
    expect(api.checked()).toEqual(['a'])
  })
})

describe('a pass that is still running', () => {
  const DUE_COUNT = 8

  it('is not joined by a second pass when the view is closed and reopened', async () => {
    const ids = Array.from({ length: DUE_COUNT }, (_, index) => `chat-${index}`)
    serve(ids.map((id) => stale(id)))
    const gate = Promise.withResolvers<void>()
    api.answerWith(async () => {
      await gate.promise
      return { status: 200 }
    })
    begin()
    await openLibrary()
    closeLibrary()
    await openLibrary()
    gate.resolve()
    await settle()
    expect(api.peakInFlight()).toBe(MAX_IN_FLIGHT)
    expect(api.checked()).toEqual(ids)
  })

  it('lets the next opening start a pass once it has finished', async () => {
    serve([stale('a')])
    begin()
    await openLibrary()
    closeLibrary()
    await openLibrary()
    expect(api.checked()).toEqual(['a', 'a'])
  })
})

describe('the session', () => {
  it('is fetched once when the view is reopened before it answers', async () => {
    serve([stale('a')])
    const gate = api.holdSession()
    begin()
    await openLibrary()
    closeLibrary()
    await openLibrary()
    gate.resolve()
    await settle()
    expect(api.sessionRequests()).toBe(1)
  })

  it('is fetched again for every pass, so an expired token is never reused', async () => {
    serve([stale('a')])
    begin()
    await openLibrary()
    closeLibrary()
    await openLibrary()
    expect(api.sessionRequests()).toBe(2)
  })

  it('is not requested when no conversation is due', async () => {
    serve([stale('fresh', { checkedAt: NOW })])
    begin()
    await openLibrary()
    expect(api.sessionRequests()).toBe(0)
  })

  it('is asked for again after a failed attempt', async () => {
    serve([stale('a')])
    api.denySession()
    begin()
    await openLibrary()
    closeLibrary()
    await openLibrary()
    expect(api.sessionRequests()).toBe(2)
  })

  it('leaves everything unchecked when there is none', async () => {
    serve([stale('a')])
    api.denySession()
    begin()
    await openLibrary()
    expect(api.checked()).toEqual([])
    expect(checkMessages()).toEqual([])
  })
})

describe('which conversations are checked', () => {
  it('checks only the ones that are due', async () => {
    serve([stale('due'), stale('fresh', { checkedAt: NOW - 1 })])
    begin()
    await openLibrary()
    expect(api.checked()).toEqual(['due'])
  })

  it('sends no check at all when nothing is due', async () => {
    serve([stale('fresh', { checkedAt: NOW })])
    begin()
    await openLibrary()
    expect(api.checked()).toEqual([])
    expect(checkMessages()).toEqual([])
  })

  it('sends no check request for a second pass within the hour', async () => {
    const conversations = [stale('a')]
    serve(conversations)
    begin()
    await openLibrary()
    conversations[0] = stale('a', { checkedAt: NOW })
    closeLibrary()
    await openLibrary()
    expect(api.checked()).toEqual(['a'])
    expect(checkMessages()).toHaveLength(1)
  })

  it('runs at most four checks at once', async () => {
    const ids = Array.from({ length: 9 }, (_, index) => `chat-${index}`)
    serve(ids.map((id) => stale(id)))
    const gate = Promise.withResolvers<void>()
    api.answerWith(async () => {
      await gate.promise
      return { status: 200 }
    })
    begin()
    await openLibrary()
    expect(api.peakInFlight()).toBe(MAX_IN_FLIGHT)
    gate.resolve()
    await settle()
    expect(api.checked()).toEqual(ids)
  })
})

describe('what is sent to the background', () => {
  it('sends the answer for an existing and a missing chat', async () => {
    serve([stale('kept'), stale('gone')])
    api.answerWith((id) => (id === 'gone' ? { status: 404 } : { status: 200, title: 'Tides' }))
    begin()
    await openLibrary()
    const kept = {
      type: 'conversation.check',
      conversationId: 'kept',
      outcome: { kind: 'exists', title: 'Tides' },
    }
    const gone = {
      type: 'conversation.check',
      conversationId: 'gone',
      outcome: { kind: 'missing' },
    }
    expect(checkMessages()).toHaveLength(2)
    expect(checkMessages()).toEqual(expect.arrayContaining([kept, gone]))
  })

  it.each([
    { name: 'a server error', answer: { status: 500 } },
    { name: 'a rate limit', answer: { status: 429 } },
    { name: 'a network failure', answer: new TypeError('offline') },
  ])('sends nothing and moves nothing for $name', async ({ answer }) => {
    serve([stale('a', { status: 'active' })])
    api.answerWith(() => answer)
    begin()
    await openLibrary()
    expect(api.checked()).toEqual(['a'])
    expect(checkMessages()).toEqual([])
    expect(store.toast.value).toBeNull()
  })
})

describe('the toast', () => {
  const trashed = (id: string) => stale(id, { status: 'trashed', trashedAt: NOW })

  it('says deleted chats moved to Recently deleted when a pass trashed one', async () => {
    serve([stale('gone')])
    api.answerWith(() => ({ status: 404 }))
    background.answerWith((message) => {
      if (fieldOf(message, 'type') === 'conversations.list') return ok([stale('gone')])
      return ok(trashed('gone'))
    })
    begin()
    await openLibrary()
    expect(store.toast.value?.message).toBe(MOVED_TO_TRASH_MESSAGE)
  })

  it('stays quiet when the chat was already in Recently deleted', async () => {
    background.answerWith((message) => {
      const listed = [stale('gone', { status: 'trashed' })]
      return ok(fieldOf(message, 'type') === 'conversations.list' ? listed : listed[0])
    })
    api.answerWith(() => ({ status: 404 }))
    begin()
    await openLibrary()
    expect(checkMessages()).toHaveLength(1)
    expect(store.toast.value).toBeNull()
  })

  it('stays quiet when a chat comes back from Recently deleted', async () => {
    background.answerWith((message) => {
      const listed = [stale('back', { status: 'trashed' })]
      return ok(fieldOf(message, 'type') === 'conversations.list' ? listed : stale('back'))
    })
    begin()
    await openLibrary()
    expect(store.toast.value).toBeNull()
  })

  it('stays quiet when the background refuses the check', async () => {
    background.answerWith((message) =>
      fieldOf(message, 'type') === 'conversations.list' ? ok([stale('gone')]) : err(WRITE_FAILURE),
    )
    api.answerWith(() => ({ status: 404 }))
    begin()
    await openLibrary()
    expect(store.toast.value).toBeNull()
  })

  it('stays quiet when the list cannot be read', async () => {
    background.answerWith(() => err(OFFLINE_FAILURE))
    begin()
    await openLibrary()
    expect(api.checked()).toEqual([])
    expect(store.toast.value).toBeNull()
  })
})

describe('stopping', () => {
  it('ignores the library from then on', async () => {
    serve([stale('a')])
    begin()
    for (const stop of stops.splice(0)) stop()
    await openLibrary()
    expect(api.sessionRequests()).toBe(0)
    expect(background.sent()).toEqual([])
  })

  it('abandons a pass that is in flight', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    background.answerWith((message) =>
      ok(
        fieldOf(message, 'type') === 'conversations.list'
          ? ids.map((id) => stale(id))
          : stale('a', { status: 'trashed' }),
      ),
    )
    const gate = Promise.withResolvers<void>()
    api.answerWith(async () => {
      await gate.promise
      return { status: 404 }
    })
    begin()
    await openLibrary()
    for (const stop of stops.splice(0)) stop()
    gate.resolve()
    await settle()
    expect(api.checked()).toHaveLength(MAX_IN_FLIGHT)
    expect(store.toast.value).toBeNull()
  })

  it('does not check anything when it stops while the list is loading', async () => {
    const gate = background.hold()
    begin()
    await openLibrary()
    for (const stop of stops.splice(0)) stop()
    gate.resolve(ok([stale('a')]))
    await settle()
    expect(api.checked()).toEqual([])
    expect(api.sessionRequests()).toBe(0)
  })

  it('checks nothing when it stops while the session loads', async () => {
    serve([stale('a')])
    const gate = api.holdSession()
    begin()
    await openLibrary()
    for (const stop of stops.splice(0)) stop()
    gate.resolve()
    await settle()
    expect(api.checked()).toEqual([])
  })
})
