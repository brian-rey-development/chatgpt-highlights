import { vi } from 'vitest'
import { CONVERSATION_URL, SESSION_URL, STATUS_MISSING, STATUS_OK } from '@/chatgpt'
import { STATUS_UNAUTHORIZED } from './fixture-ids'
import { sessionJson } from './fixtures'

export type ChatAnswer = { status: number; title?: string } | Error

export interface FakeChatGptApi {
  answerWith: (answer: (conversationId: string) => ChatAnswer | Promise<ChatAnswer>) => void
  denySession: () => void
  holdSession: () => PromiseWithResolvers<void>
  sessionRequests: () => number
  checked: () => string[]
  peakInFlight: () => number
}

const CONVERSATION_PREFIX = `${CONVERSATION_URL}/`

export const installFakeChatGptApi = (): FakeChatGptApi => {
  let answer: (id: string) => ChatAnswer | Promise<ChatAnswer> = () => ({ status: STATUS_OK })
  let sessionStatus = STATUS_OK
  let sessionCount = 0
  let sessionGate: Promise<void> = Promise.resolve()
  let inFlight = 0
  let peak = 0
  const checked: string[] = []

  const answerConversation = async (id: string): Promise<Response> => {
    checked.push(id)
    inFlight += 1
    peak = Math.max(peak, inFlight)
    try {
      const reply = await answer(id)
      if (reply instanceof Error) throw reply
      return new Response(JSON.stringify({ title: reply.title ?? '' }), { status: reply.status })
    } finally {
      inFlight -= 1
    }
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === SESSION_URL) {
        sessionCount += 1
        await sessionGate
        return new Response(sessionJson, { status: sessionStatus })
      }
      return url.startsWith(CONVERSATION_PREFIX)
        ? answerConversation(url.slice(CONVERSATION_PREFIX.length))
        : new Response('', { status: STATUS_MISSING })
    }),
  )

  return {
    answerWith: (next) => {
      answer = next
    },
    denySession: () => {
      sessionStatus = STATUS_UNAUTHORIZED
    },
    holdSession: () => {
      const gate = Promise.withResolvers<void>()
      sessionGate = gate.promise
      return gate
    },
    sessionRequests: () => sessionCount,
    checked: () => checked,
    peakInFlight: () => peak,
  }
}
