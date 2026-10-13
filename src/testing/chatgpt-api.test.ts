import { describe, expect, it, vi } from 'vitest'
import { checkConversation, fetchSession } from '@/chatgpt'
import { installFakeChatGptApi } from './chatgpt-api'
import { settle } from './dom'

describe('installFakeChatGptApi', () => {
  it('serves the recon session and counts the requests for it', async () => {
    const api = installFakeChatGptApi()
    await expect(fetchSession()).resolves.toEqual({ token: 'test-access-token' })
    await fetchSession()
    expect(api.sessionRequests()).toBe(2)
  })

  it('refuses the session once denied', async () => {
    installFakeChatGptApi().denySession()
    await expect(fetchSession()).resolves.toBeNull()
  })

  it('keeps the session waiting until the gate is opened', async () => {
    vi.useFakeTimers()
    const api = installFakeChatGptApi()
    const gate = api.holdSession()
    const waiting = vi.fn()
    const session = fetchSession().then(waiting)
    await settle()
    expect(waiting).not.toHaveBeenCalled()
    gate.resolve()
    await session
    expect(waiting).toHaveBeenCalledWith({ token: 'test-access-token' })
  })

  it('answers each check with the given status and title and records the id', async () => {
    const api = installFakeChatGptApi()
    api.answerWith((id) => (id === 'gone' ? { status: 404 } : { status: 200, title: 'Tides' }))
    const session = { token: 'token' }
    await expect(checkConversation(session, 'kept')).resolves.toEqual({
      kind: 'exists',
      title: 'Tides',
    })
    await expect(checkConversation(session, 'gone')).resolves.toEqual({ kind: 'missing' })
    expect(api.checked()).toEqual(['kept', 'gone'])
  })

  it('lets a check fail like a network error', async () => {
    const api = installFakeChatGptApi()
    api.answerWith(() => new TypeError('offline'))
    await expect(checkConversation({ token: 'token' }, 'any')).resolves.toEqual({
      kind: 'unknown',
    })
  })

  it('reports the most checks that were waiting for an answer at once', async () => {
    const api = installFakeChatGptApi()
    const gate = Promise.withResolvers<void>()
    api.answerWith(async () => {
      await gate.promise
      return { status: 200 }
    })
    const session = { token: 'token' }
    const checks = [checkConversation(session, 'a'), checkConversation(session, 'b')]
    gate.resolve()
    await Promise.all(checks)
    expect(api.peakInFlight()).toBe(2)
  })

  it('answers 404 for any other address without recording a check', async () => {
    const api = installFakeChatGptApi()
    const response = await fetch('https://chatgpt.com/elsewhere')
    expect(response.status).toBe(404)
    expect(api.checked()).toEqual([])
  })
})
