import { type Browser, browser } from 'wxt/browser'
import { CHATGPT_MATCH, LIBRARY_URL } from '@/chatgpt'
import { sendTabCommand } from '@/messaging'

type Tab = Browser.tabs.Tab
type IdentifiedTab = Tab & { id: number }

const hasId = (tab: Tab): tab is IdentifiedTab => tab.id !== undefined

const preferredTab = (tabs: readonly Tab[]): IdentifiedTab | undefined => {
  const identified = tabs.filter(hasId)
  return identified.find((tab) => tab.active) ?? identified[0]
}

const findChatgptTab = async (): Promise<IdentifiedTab | undefined> => {
  const inFocusedWindow = await browser.tabs.query({
    url: CHATGPT_MATCH,
    active: true,
    lastFocusedWindow: true,
  })
  return (
    preferredTab(inFocusedWindow) ?? preferredTab(await browser.tabs.query({ url: CHATGPT_MATCH }))
  )
}

const showLibraryIn = async ({ id, windowId }: IdentifiedTab): Promise<boolean> => {
  try {
    await browser.tabs.update(id, { active: true })
    await browser.windows.update(windowId, { focused: true })
    await sendTabCommand(id, { type: 'library.open' })
    return true
  } catch {
    return false
  }
}

export const openLibrary = async (): Promise<void> => {
  const tab = await findChatgptTab()
  if (tab && (await showLibraryIn(tab))) return
  await browser.tabs.create({ url: LIBRARY_URL })
}

export const startToolbarAction = (): void => {
  browser.action.onClicked.addListener(openLibrary)
}
