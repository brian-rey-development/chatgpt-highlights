import { describe, expect, expectTypeOf, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { ok } from '@/errors'
import type { RequestType } from '@/messaging'
import { answerOf, deliverMessage, installFakeBackground } from './background'

const LOAD = { type: 'conversation.load', conversationId: 'c1' }
const LIST = { type: 'conversations.list' }

describe('installFakeBackground', () => {
  it('answers each message with the responder and records it', async () => {
    const background = installFakeBackground()
    background.answerWith((message) => ok(message))
    expect(await fakeBrowser.runtime.sendMessage(LOAD)).toEqual(ok(LOAD))
    expect(background.sent()).toEqual([LOAD])
  })

  it('lists the messages of one type', async () => {
    const background = installFakeBackground()
    await fakeBrowser.runtime.sendMessage(LOAD)
    await fakeBrowser.runtime.sendMessage(LIST)
    expect(background.sent('conversations.list')).toEqual([LIST])
    expect(background.sent()).toEqual([LOAD, LIST])
  })

  it('answers nothing until a responder is given', async () => {
    installFakeBackground()
    expect(await fakeBrowser.runtime.sendMessage(LOAD)).toBeUndefined()
  })

  it('holds the answer back until the gate is resolved', async () => {
    const background = installFakeBackground()
    const gate = background.hold()
    const answer = fakeBrowser.runtime.sendMessage(LOAD)
    gate.resolve(ok(LOAD))
    expect(await answer).toEqual(ok(LOAD))
    expect(background.sent()).toEqual([LOAD])
  })

  it('filters only by the names of real requests', () => {
    const background = installFakeBackground()
    expectTypeOf(background.sent).parameter(0).toEqualTypeOf<RequestType | undefined>()
  })
})

describe('deliverMessage', () => {
  it('waits for the answer of a listener that answers later', async () => {
    fakeBrowser.runtime.onMessage.addListener((_message, _sender, respond) => {
      setTimeout(() => respond('late'), 0)
      return true
    })
    expect(await deliverMessage(LOAD)).toEqual({ results: [true], responses: ['late'] })
    expect(await answerOf(LOAD)).toBe('late')
  })

  it('returns without an answer when no listener takes the message', async () => {
    fakeBrowser.runtime.onMessage.addListener(() => false)
    expect(await deliverMessage(LOAD)).toEqual({ results: [false], responses: [] })
    expect(await answerOf(LOAD)).toBeUndefined()
  })
})
