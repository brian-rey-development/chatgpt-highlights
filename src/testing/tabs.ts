import { vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { dataChanged } from './thread'

export const FAKE_WINDOW_ID = 1
export const FAKE_TAB_ID = 3
const NO_GROUP_ID = -1
const NO_RECEIVER = 'Receiving end does not exist'

export interface FakeTab {
  id: number | undefined
  windowId?: number
  active?: boolean
  unreachable?: boolean
}

export interface SentMessage {
  tabId: number
  message: unknown
}

export const makeFakeTab = ({
  id,
  windowId = FAKE_WINDOW_ID,
  active = false,
}: FakeTab): Browser.tabs.Tab => ({
  id,
  index: 0,
  pinned: false,
  highlighted: false,
  windowId,
  active,
  incognito: false,
  frozen: false,
  selected: active,
  discarded: false,
  autoDiscardable: true,
  groupId: NO_GROUP_ID,
  lastAccessed: 0,
})

export const changedIn = (...conversationIds: string[]): SentMessage[] => [
  { tabId: FAKE_TAB_ID, message: dataChanged(...conversationIds) },
]

const matchesQuery = (
  { active, windowId }: Browser.tabs.Tab,
  query: Browser.tabs.QueryInfo,
  focusedWindowId: number,
): boolean =>
  (query.active === undefined || query.active === active) &&
  (!query.lastFocusedWindow || windowId === focusedWindowId)

export const installFakeTabs = (
  tabs: readonly FakeTab[],
  focusedWindowId: number = FAKE_WINDOW_ID,
): SentMessage[] => {
  const sent: SentMessage[] = []
  const deliver = async (tabId: number, message: unknown): Promise<void> => {
    if (tabs.some((tab) => tab.id === tabId && tab.unreachable)) throw new Error(NO_RECEIVER)
    sent.push({ tabId, message })
  }
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(async (query: Browser.tabs.QueryInfo) =>
    tabs.map(makeFakeTab).filter((tab) => matchesQuery(tab, query, focusedWindowId)),
  )
  vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(deliver)
  return sent
}
