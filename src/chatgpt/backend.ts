import { type CheckOutcome, fieldOf } from '@/model'
import { CHATGPT_ORIGIN } from './url'

export interface Session {
  token: string
}

export const SESSION_URL = `${CHATGPT_ORIGIN}/api/auth/session`
export const CONVERSATION_URL = `${CHATGPT_ORIGIN}/backend-api/conversation`
export const STATUS_OK = 200
export const STATUS_MISSING = 404
export const FETCH_TIMEOUT_MS = 10_000
const UNKNOWN: CheckOutcome = { kind: 'unknown' }

type Fetcher = typeof fetch

interface PageScope {
  fetch: Fetcher
}

const hasFetch = (scope: unknown): scope is PageScope =>
  typeof fieldOf(scope, 'fetch') === 'function'

const defaultFetcher = (): Fetcher => {
  const scope: unknown = Reflect.get(globalThis, 'content')
  return hasFetch(scope) ? scope.fetch.bind(scope) : fetch
}

const readToken = (body: unknown): string | null => {
  const token = fieldOf(body, 'accessToken')
  return typeof token === 'string' && token !== '' ? token : null
}

const readTitle = (body: unknown): string => {
  const title = fieldOf(body, 'title')
  return typeof title === 'string' ? title : ''
}

export const fetchSession = async (fetcher?: Fetcher): Promise<Session | null> => {
  try {
    const send = fetcher ?? defaultFetcher()
    const response = await send(SESSION_URL, {
      credentials: 'include',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (response.status !== STATUS_OK) return null
    const token = readToken(await response.json())
    return token ? { token } : null
  } catch {
    return null
  }
}

const outcomeOf = async (response: Response): Promise<CheckOutcome> => {
  if (response.status === STATUS_MISSING) return { kind: 'missing' }
  if (response.status !== STATUS_OK) return UNKNOWN
  return { kind: 'exists', title: readTitle(await response.json()) }
}

export const checkConversation = async (
  session: Session,
  conversationId: string,
  fetcher?: Fetcher,
): Promise<CheckOutcome> => {
  if (session.token === '') return UNKNOWN
  try {
    const send = fetcher ?? defaultFetcher()
    const response = await send(`${CONVERSATION_URL}/${encodeURIComponent(conversationId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.token}` },
      credentials: 'include',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return await outcomeOf(response)
  } catch {
    return UNKNOWN
  }
}
