import { browser } from 'wxt/browser'
import { err, messageOf, type Result, toAppError } from '@/errors'
import { fieldOf, MINUTE_MS } from '@/model'
import type { Route } from './router'
import type { AppEvent, Request, RequestOf, RequestType, Responses, TabCommand } from './types'

type Unsubscribe = () => void
type SendResponse = (response?: unknown) => void

const APP_EVENT_TYPE: AppEvent['type'] = 'data.changed'
const TAB_COMMAND_TYPE: TabCommand['type'] = 'library.open'
const NO_ANSWER_REASON = 'The background did not answer'
const TIMEOUT_REASON = 'The background took too long to answer'
export const REQUEST_TIMEOUT_MS = 15_000
const BACKUP_TIMEOUT_MINUTES = 5
export const BACKUP_TIMEOUT_MS = BACKUP_TIMEOUT_MINUTES * MINUTE_MS
const BACKUP_TYPES: ReadonlySet<RequestType> = new Set(['backup.export', 'backup.import'])

type Effect = 'read' | 'write'

// Only reads may be sent twice, because a write the worker committed before it died would repeat
const REQUEST_EFFECTS: { [T in RequestType]: Effect } = {
  'conversation.load': 'read',
  'conversations.list': 'read',
  'library.snapshot': 'read',
  'backup.export': 'read',
  'conversation.check': 'write',
  'conversation.purge': 'write',
  'highlight.create': 'write',
  'highlight.update': 'write',
  'highlight.delete': 'write',
  'highlight.restore': 'write',
  'backup.import': 'write',
}

const canRetry = ({ type }: Request): boolean => REQUEST_EFFECTS[type] === 'read'

const deadlineOf = ({ type }: Request): number =>
  BACKUP_TYPES.has(type) ? BACKUP_TIMEOUT_MS : REQUEST_TIMEOUT_MS

const hasType = (message: unknown, type: string): boolean => fieldOf(message, 'type') === type

const isAppEvent = (message: unknown): message is AppEvent => {
  const conversationIds = fieldOf(message, 'conversationIds')
  return (
    hasType(message, APP_EVENT_TYPE) &&
    Array.isArray(conversationIds) &&
    conversationIds.every((id) => typeof id === 'string')
  )
}

const isTabCommand = (message: unknown): message is TabCommand => hasType(message, TAB_COMMAND_TYPE)

const isResult = (value: unknown): value is Result<unknown> => {
  const okField = fieldOf(value, 'ok')
  return (
    okField === true ||
    (okField === false && typeof fieldOf(fieldOf(value, 'error'), 'code') === 'string')
  )
}

const withDeadline = <T>(pending: Promise<T>, deadlineMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(TIMEOUT_REASON)), deadlineMs)
    pending.then(resolve, reject).finally(() => clearTimeout(timer))
  })

const attempt = async (message: Request): Promise<Result<unknown> | string> => {
  try {
    const answer: unknown = await withDeadline(
      browser.runtime.sendMessage(message),
      deadlineOf(message),
    )
    return isResult(answer) ? answer : NO_ANSWER_REASON
  } catch (error) {
    return messageOf(error)
  }
}

export const request = async <T extends RequestType>(
  message: RequestOf<T>,
): Promise<Result<Responses[T]>> => {
  const first = await attempt(message)
  const answer = typeof first === 'string' && canRetry(message) ? await attempt(message) : first
  if (typeof answer === 'string') return err({ code: 'unreachable', message: answer })
  // The router answers T with Responses[T]
  return answer as Result<Responses[T]>
}

const isOwnSender = (sender: unknown): boolean => fieldOf(sender, 'id') === browser.runtime.id

const answerFor = async (route: Route, message: unknown): Promise<Result<unknown>> => {
  try {
    return await route(message)
  } catch (error) {
    return err(toAppError(error))
  }
}

const reply = async (route: Route, message: unknown, sendResponse: SendResponse): Promise<void> => {
  const result = await answerFor(route, message)
  try {
    sendResponse(result)
  } catch {
    // The caller closed its channel, so there is nobody left to tell
  }
}

export const serve = (route: Route): Unsubscribe => {
  const onRequest = (message: unknown, sender: unknown, sendResponse: SendResponse): boolean => {
    if (isAppEvent(message) || isTabCommand(message) || !isOwnSender(sender)) return false
    void reply(route, message, sendResponse)
    return true
  }
  browser.runtime.onMessage.addListener(onRequest)
  return () => browser.runtime.onMessage.removeListener(onRequest)
}

const listenFor = <M>(
  isMessage: (message: unknown) => message is M,
  listener: (message: M) => void,
): Unsubscribe => {
  const onMessage = (message: unknown, _sender: unknown, sendResponse: SendResponse): boolean => {
    if (!isMessage(message)) return false
    listener(message)
    sendResponse(null)
    return false
  }
  browser.runtime.onMessage.addListener(onMessage)
  return () => browser.runtime.onMessage.removeListener(onMessage)
}

export const onEvent = (listener: (event: AppEvent) => void): Unsubscribe =>
  listenFor(isAppEvent, listener)

export const onTabCommand = (listener: (command: TabCommand) => void): Unsubscribe =>
  listenFor(isTabCommand, listener)

const listTabIds = async (urlPattern: string): Promise<number[]> => {
  try {
    const tabs = await browser.tabs.query({ url: urlPattern })
    return tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]))
  } catch {
    // Announcements are best effort
    return []
  }
}

const pendingLookups = new Map<string, Promise<number[]>>()

const lookupTabIds = (urlPattern: string): Promise<number[]> => {
  const pending = pendingLookups.get(urlPattern)
  if (pending) return pending
  const lookup = listTabIds(urlPattern).finally(() => pendingLookups.delete(urlPattern))
  pendingLookups.set(urlPattern, lookup)
  return lookup
}

export const broadcast = async (event: AppEvent, urlPattern: string): Promise<void> => {
  const tabIds = await lookupTabIds(urlPattern)
  await Promise.allSettled(tabIds.map((tabId) => browser.tabs.sendMessage(tabId, event)))
}

export const sendTabCommand = async (tabId: number, command: TabCommand): Promise<void> => {
  await browser.tabs.sendMessage(tabId, command)
}
