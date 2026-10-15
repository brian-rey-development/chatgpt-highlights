import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { LIBRARY_URL } from '@/chatgpt'
import {
  FAKE_TAB_ID,
  FAKE_WINDOW_ID,
  installFakeTabs,
  LIBRARY_OPEN,
  makeFakeTab,
  type SentMessage,
} from '@/testing'
import { openLibrary, startToolbarAction } from './toolbar-action'

const ACTIVE_TAB_ID = 4
const ACTIVE_WINDOW_ID = 8

let steps: string[]
let sent: SentMessage[]

const installFakeBrowserCalls = (): void => {
  steps = []
  vi.spyOn(fakeBrowser.tabs, 'update').mockImplementation(async (tabId) => {
    steps.push(`activate ${tabId}`)
  })
  vi.spyOn(fakeBrowser.windows, 'update').mockImplementation(async (windowId) => {
    steps.push(`focus ${windowId}`)
  })
  vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(async ({ url }) => {
    steps.push(`create ${url}`)
  })
}

beforeEach(installFakeBrowserCalls)

describe('openLibrary', () => {
  it('activates an open chatgpt tab, focuses its window and then sends library.open', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID, windowId: ACTIVE_WINDOW_ID }])
    await openLibrary()
    expect(steps).toEqual([`activate ${FAKE_TAB_ID}`, `focus ${ACTIVE_WINDOW_ID}`])
    expect(vi.mocked(fakeBrowser.windows.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fakeBrowser.tabs.sendMessage).mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('sends the command to the tab it activated', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID }])
    await openLibrary()
    expect(sent).toEqual([{ tabId: FAKE_TAB_ID, message: LIBRARY_OPEN }])
  })

  it('prefers the chatgpt tab the user is looking at', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID }, { id: ACTIVE_TAB_ID, active: true }])
    await openLibrary()
    expect(sent.map(({ tabId }) => tabId)).toEqual([ACTIVE_TAB_ID])
  })

  it('prefers the chatgpt tab in the window the user is in', async () => {
    sent = installFakeTabs(
      [
        { id: FAKE_TAB_ID, active: true },
        { id: ACTIVE_TAB_ID, active: true, windowId: ACTIVE_WINDOW_ID },
      ],
      ACTIVE_WINDOW_ID,
    )
    await openLibrary()
    expect(sent.map(({ tabId }) => tabId)).toEqual([ACTIVE_TAB_ID])
  })

  it('opens a new tab when the chatgpt tab closed before it could be activated', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID }])
    vi.spyOn(fakeBrowser.tabs, 'update').mockRejectedValue(new Error('No tab with id'))
    await openLibrary()
    expect(steps).toEqual([`create ${LIBRARY_URL}`])
    expect(sent).toEqual([])
  })

  it('opens a tab at the library hash when no chatgpt tab is open', async () => {
    sent = installFakeTabs([])
    await openLibrary()
    expect(steps).toEqual([`create ${LIBRARY_URL}`])
    expect(sent).toEqual([])
  })

  it('opens a new tab at the library hash when the chatgpt tab has no content script', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID, unreachable: true }])
    await openLibrary()
    expect(steps).toEqual([
      `activate ${FAKE_TAB_ID}`,
      `focus ${FAKE_WINDOW_ID}`,
      `create ${LIBRARY_URL}`,
    ])
    expect(sent).toEqual([])
  })

  it('ignores tabs that have no id', async () => {
    sent = installFakeTabs([{ id: undefined }])
    await openLibrary()
    expect(steps).toEqual([`create ${LIBRARY_URL}`])
  })
})

describe('startToolbarAction', () => {
  it('opens the library when the toolbar button is clicked', async () => {
    sent = installFakeTabs([{ id: FAKE_TAB_ID }])
    startToolbarAction()
    await fakeBrowser.action.onClicked.trigger(makeFakeTab({ id: FAKE_TAB_ID }))
    expect(sent).toEqual([{ tabId: FAKE_TAB_ID, message: LIBRARY_OPEN }])
  })

  it('reports a click that cannot open the library instead of leaving it unhandled', async () => {
    const report = vi.fn()
    vi.stubGlobal('reportError', report)
    const failure = new Error('tabs are gone')
    installFakeTabs([])
    vi.spyOn(fakeBrowser.tabs, 'create').mockRejectedValue(failure)
    startToolbarAction()
    await fakeBrowser.action.onClicked.trigger(makeFakeTab({ id: FAKE_TAB_ID }))
    expect(report).toHaveBeenCalledWith(failure)
  })
})
