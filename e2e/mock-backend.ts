import type { BrowserContext, Route } from '@playwright/test'
import { CONVERSATION_URL, conversationIdFromPath, SESSION_URL, STATUS_OK } from '@/chatgpt'
import { fieldOf, JSON_MEDIA_TYPE } from '@/model'
import {
  FIXTURE_CONVERSATION_ID,
  OTHER_CONVERSATION_ID,
  STATUS_UNAUTHORIZED,
} from '@/testing/fixture-ids'
import { conversationHtml, renderPage, sessionJson, type Theme } from './chatgpt-page/page'

const STATUS_NO_CONTENT = 204

const SESSION_PATH = new URL(SESSION_URL).pathname
const CONVERSATION_PATH = `${new URL(CONVERSATION_URL).pathname}/`
const ACCESS_TOKEN = String(fieldOf(JSON.parse(sessionJson), 'accessToken'))

const FIXTURE_CONVERSATION_TITLE = 'Tides'
export const OTHER_CONVERSATION_TITLE = 'Second chat'

const DEFAULT_TITLES: ReadonlyMap<string, string> = new Map([
  [FIXTURE_CONVERSATION_ID, FIXTURE_CONVERSATION_TITLE],
  [OTHER_CONVERSATION_ID, OTHER_CONVERSATION_TITLE],
])

export interface MockBackend {
  respondToConversation: (conversationId: string, status: number) => void
  serveThread: (conversationId: string, thread: string, title: string) => void
}

interface BackendState {
  theme: Theme
  statuses: Map<string, number>
  threads: Map<string, { thread: string; title: string }>
}

const json = (route: Route, body: unknown, status = STATUS_OK): Promise<void> =>
  route.fulfill({ status, contentType: JSON_MEDIA_TYPE, body: JSON.stringify(body) })

const answerConversation = (state: BackendState, route: Route, conversationId: string) => {
  const { authorization } = route.request().headers()
  if (authorization !== `Bearer ${ACCESS_TOKEN}`) return json(route, {}, STATUS_UNAUTHORIZED)
  const status = state.statuses.get(conversationId) ?? STATUS_OK
  if (status !== STATUS_OK) return json(route, {}, status)
  const title = state.threads.get(conversationId)?.title ?? DEFAULT_TITLES.get(conversationId)
  return json(route, { title: title ?? 'Chat' })
}

const answerPage = (state: BackendState, route: Route, pathname: string) => {
  const conversationId = conversationIdFromPath(pathname)
  const served = conversationId ? state.threads.get(conversationId) : undefined
  const title = served?.title ?? DEFAULT_TITLES.get(conversationId ?? '') ?? 'ChatGPT'
  const body = renderPage({
    theme: state.theme,
    title,
    thread: served?.thread ?? conversationHtml,
  })
  return route.fulfill({ status: STATUS_OK, contentType: 'text/html', body })
}

const answer = (state: BackendState, route: Route) => {
  const request = route.request()
  const { pathname } = new URL(request.url())
  if (pathname === SESSION_PATH)
    return route.fulfill({
      status: STATUS_OK,
      contentType: JSON_MEDIA_TYPE,
      body: sessionJson,
    })
  if (pathname.startsWith(CONVERSATION_PATH)) {
    return answerConversation(
      state,
      route,
      decodeURIComponent(pathname.slice(CONVERSATION_PATH.length)),
    )
  }
  if (request.resourceType() === 'document') return answerPage(state, route, pathname)
  return route.fulfill({ status: STATUS_NO_CONTENT })
}

export const installBackend = async (
  context: BrowserContext,
  theme: Theme,
): Promise<MockBackend> => {
  const state: BackendState = { theme, statuses: new Map(), threads: new Map() }
  await context.route('https://chatgpt.com/**', (route) => answer(state, route))
  return {
    respondToConversation: (conversationId, status) => {
      state.statuses.set(conversationId, status)
    },
    serveThread: (conversationId, thread, title) => {
      state.threads.set(conversationId, { thread, title })
    },
  }
}
