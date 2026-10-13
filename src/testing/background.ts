import { vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { AppError } from '@/errors'
import type { RequestType } from '@/messaging'
import { fieldOf } from '@/model'

export type Responder = (message: unknown) => unknown

export const WRITE_FAILURE: AppError = { code: 'unexpected', message: 'The write failed' }
export const OFFLINE_FAILURE: AppError = { code: 'unreachable', message: 'offline' }

export interface FakeBackground {
  sent: (type?: RequestType) => unknown[]
  answerWith: (respond: Responder) => void
  hold: () => PromiseWithResolvers<unknown>
}

export const installFakeBackground = (): FakeBackground => {
  const messages: unknown[] = []
  let respond: Responder = () => undefined
  const answer = async (message: unknown): Promise<unknown> => {
    messages.push(message)
    return respond(message)
  }
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(answer)
  const answerWith = (next: Responder): void => {
    respond = next
  }
  return {
    sent: (type) =>
      messages.filter((message) => type === undefined || fieldOf(message, 'type') === type),
    answerWith,
    hold: () => {
      const gate = Promise.withResolvers<unknown>()
      answerWith(() => gate.promise)
      return gate
    },
  }
}

export interface Delivery {
  results: unknown[]
  responses: unknown[]
}

export const deliverMessage = async (message: unknown): Promise<Delivery> => {
  const responses: unknown[] = []
  const answered = Promise.withResolvers<void>()
  const results: unknown[] = await fakeBrowser.runtime.onMessage.trigger(
    message,
    {},
    (response: unknown) => {
      responses.push(response)
      answered.resolve()
    },
  )
  if (results.includes(true)) await answered.promise
  return { results, responses }
}

export const answerOf = async (message: unknown): Promise<unknown> =>
  (await deliverMessage(message)).responses[0]
