import { describe, expect, it, vi } from 'vitest'
import { FIXTURE_CONVERSATION_ID, sessionJson } from '@/testing'
import { checkConversation, fetchSession, STATUS_MISSING, STATUS_OK } from './backend'

const SESSION = { token: 'test-access-token' }

const reply = (status: number, body: unknown = {}): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

const fetcherReturning = (response: Response | Error) =>
  vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })

describe('the status codes it shares with test fakes', () => {
  it('are the HTTP ones for success and a missing conversation', () => {
    expect(STATUS_OK).toBe(200)
    expect(STATUS_MISSING).toBe(404)
  })
})

describe('fetchSession', () => {
  it('maps the recon session payload to a token', async () => {
    const fetcher = fetcherReturning(reply(200, sessionJson))
    await expect(fetchSession(fetcher)).resolves.toEqual(SESSION)
    expect(fetcher).toHaveBeenCalledWith('https://chatgpt.com/api/auth/session', {
      credentials: 'include',
    })
  })

  it.each([
    { name: 'a non-200 status', response: reply(401, sessionJson) },
    { name: 'a payload without a token', response: reply(200, { user: {} }) },
    { name: 'an empty token', response: reply(200, { accessToken: '' }) },
    { name: 'a non-string token', response: reply(200, { accessToken: 7 }) },
    { name: 'a non-object payload', response: reply(200, 'null') },
    { name: 'a body that is not json', response: reply(200, 'oops') },
    { name: 'a thrown fetch', response: new TypeError('offline') },
  ])('returns null for $name', async ({ response }) => {
    await expect(fetchSession(fetcherReturning(response))).resolves.toBeNull()
  })
})

describe('checkConversation', () => {
  it('sends an authenticated GET with credentials', async () => {
    const fetcher = fetcherReturning(reply(200, { title: 'Tides' }))
    await checkConversation(SESSION, FIXTURE_CONVERSATION_ID, fetcher)
    expect(fetcher).toHaveBeenCalledWith(
      `https://chatgpt.com/backend-api/conversation/${FIXTURE_CONVERSATION_ID}`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer test-access-token' },
        credentials: 'include',
      },
    )
  })

  it('reports an existing chat with its title', async () => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(reply(200, { title: 'Tides' })),
    )
    expect(outcome).toEqual({ kind: 'exists', title: 'Tides' })
  })

  it.each([
    { name: 'missing', payload: {} },
    { name: 'not a string', payload: { title: 3 } },
    { name: 'null', payload: null },
  ])('reports an empty title when it is $name', async ({ payload }) => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(reply(200, payload)),
    )
    expect(outcome).toEqual({ kind: 'exists', title: '' })
  })

  it('reports a 404 as missing', async () => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(reply(404)),
    )
    expect(outcome).toEqual({ kind: 'missing' })
  })

  it.each([400, 401, 403, 429, 500])('keeps status %i unknown', async (status) => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(reply(status)),
    )
    expect(outcome).toEqual({ kind: 'unknown' })
  })

  it('keeps a network error unknown', async () => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(new TypeError('offline')),
    )
    expect(outcome).toEqual({ kind: 'unknown' })
  })

  it('keeps a 200 with an unreadable body unknown', async () => {
    const outcome = await checkConversation(
      SESSION,
      FIXTURE_CONVERSATION_ID,
      fetcherReturning(reply(200, 'oops')),
    )
    expect(outcome).toEqual({ kind: 'unknown' })
  })

  it('never sends a request without a token', async () => {
    const fetcher = fetcherReturning(reply(404))
    const outcome = await checkConversation({ token: '' }, FIXTURE_CONVERSATION_ID, fetcher)
    expect(outcome).toEqual({ kind: 'unknown' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('encodes the conversation id in the path', async () => {
    const fetcher = fetcherReturning(reply(404))
    await checkConversation(SESSION, 'a/b', fetcher)
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://chatgpt.com/backend-api/conversation/a%2Fb')
  })
})

describe('default fetcher', () => {
  it('uses the page context fetch when content.fetch exists', async () => {
    const contentFetch = fetcherReturning(reply(200, sessionJson))
    const pageFetch = fetcherReturning(reply(500))
    vi.stubGlobal('content', { fetch: contentFetch })
    vi.stubGlobal('fetch', pageFetch)
    await expect(fetchSession()).resolves.toEqual(SESSION)
    expect(pageFetch).not.toHaveBeenCalled()
  })

  it('binds content.fetch to the content object', async () => {
    const receivers: unknown[] = []
    const content = {
      fetch: vi.fn<typeof fetch>(async function (this: unknown) {
        receivers.push(this)
        return reply(404)
      }),
    }
    vi.stubGlobal('content', content)
    await expect(checkConversation(SESSION, FIXTURE_CONVERSATION_ID)).resolves.toEqual({
      kind: 'missing',
    })
    expect(receivers).toEqual([content])
  })

  it('falls back to the global fetch otherwise', async () => {
    const pageFetch = fetcherReturning(reply(200, sessionJson))
    vi.stubGlobal('fetch', pageFetch)
    await expect(fetchSession()).resolves.toEqual(SESSION)
    expect(pageFetch).toHaveBeenCalledOnce()
  })

  it('falls back when content has no fetch', async () => {
    const pageFetch = fetcherReturning(reply(404))
    vi.stubGlobal('content', {})
    vi.stubGlobal('fetch', pageFetch)
    await expect(checkConversation(SESSION, FIXTURE_CONVERSATION_ID)).resolves.toEqual({
      kind: 'missing',
    })
    expect(pageFetch).toHaveBeenCalledOnce()
  })

  it('never throws when reading content is denied', async () => {
    const deny = (): never => {
      throw new Error('SecurityError')
    }
    const denied = new Proxy({}, { get: deny, has: deny })
    vi.stubGlobal('content', denied)
    await expect(fetchSession()).resolves.toBeNull()
    await expect(checkConversation(SESSION, FIXTURE_CONVERSATION_ID)).resolves.toEqual({
      kind: 'unknown',
    })
  })
})
