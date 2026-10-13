import { browser } from 'wxt/browser'
import { err, messageOf, type Result } from '@/errors'
import { fieldOf } from '@/model'
import type { Route } from './router'
import type { AppEvent, Request, RequestOf, RequestType, Responses, TabCommand } from './types'

type Unsubscribe = () => void
type SendResponse = (response?: unknown) => void

const APP_EVENT_TYPE: AppEvent['type'] = 'data.changed'
const TAB_COMMAND_TYPE: TabCommand['type'] = 'library.open'
const NO_ANSWER_REASON = 'The background did not answer'

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
  const succeeded = fieldOf(value, 'ok')
  return (
    succeeded === true ||
    (succeeded === false && typeof fieldOf(fieldOf(value, 'error'), 'code') === 'string')
  )
}

const attempt = async (message: Request): Promise<Result<unknown> | string> => {
  try {
    const answer: unknown = await browser.runtime.sendMessage(message)
    return isResult(answer) ? answer : NO_ANSWER_REASON
  } catch (error) {
    return messageOf(error)
  }
}

export const request = async <T extends RequestType>(
  message: RequestOf<T>,
): Promise<Result<Responses[T]>> => {
  const first = await attempt(message)
  const answer = typeof first === 'string' ? await attempt(message) : first
  if (typeof answer === 'string') return err({ code: 'unreachable', message: answer })
  // The router answers T with Responses[T]
  return answer as Result<Responses[T]>
}

export const serve = (route: Route): Unsubscribe => {
  const handle = (message: unknown, _sender: unknown, sendResponse: SendResponse): boolean => {
    if (isAppEvent(message) || isTabCommand(message)) return false
    void route(message).then(sendResponse)
    return true
  }
  browser.runtime.onMessage.addListener(handle)
  return () => browser.runtime.onMessage.removeListener(handle)
}

const listenFor = <M>(
  isMessage: (message: unknown) => message is M,
  listener: (message: M) => void,
): Unsubscribe => {
  const handle = (message: unknown, _sender: unknown, sendResponse: SendResponse): boolean => {
    if (!isMessage(message)) return false
    listener(message)
    sendResponse(null)
    return false
  }
  browser.runtime.onMessage.addListener(handle)
  return () => browser.runtime.onMessage.removeListener(handle)
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

export const broadcast = async (event: AppEvent, urlPattern: string): Promise<void> => {
  const tabIds = await listTabIds(urlPattern)
  await Promise.allSettled(tabIds.map((tabId) => browser.tabs.sendMessage(tabId, event)))
}

export const sendTabCommand = async (tabId: number, command: TabCommand): Promise<void> => {
  await browser.tabs.sendMessage(tabId, command)
}
