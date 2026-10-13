import { describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { changedIn, FAKE_TAB_ID, FAKE_WINDOW_ID, installFakeTabs } from './tabs'
import { LIBRARY_OPEN } from './thread'

const OTHER_WINDOW_ID = 9

describe('installFakeTabs', () => {
  it('answers a tab query with the given tabs, filling the window and active flag', async () => {
    installFakeTabs([{ id: 3 }, { id: 4, windowId: OTHER_WINDOW_ID, active: true }])
    const tabs = await fakeBrowser.tabs.query({})
    expect(tabs.map(({ id, windowId, active }) => ({ id, windowId, active }))).toEqual([
      { id: 3, windowId: FAKE_WINDOW_ID, active: false },
      { id: 4, windowId: OTHER_WINDOW_ID, active: true },
    ])
  })

  it('records every message sent to a tab', async () => {
    const sent = installFakeTabs([{ id: 3 }])
    await fakeBrowser.tabs.sendMessage(3, LIBRARY_OPEN)
    expect(sent).toEqual([{ tabId: 3, message: LIBRARY_OPEN }])
  })

  it('rejects a message to an unreachable tab and records nothing for it', async () => {
    const sent = installFakeTabs([{ id: 3, unreachable: true }, { id: 4 }])
    await expect(fakeBrowser.tabs.sendMessage(3, {})).rejects.toThrow('Receiving end')
    await fakeBrowser.tabs.sendMessage(4, {})
    expect(sent).toEqual([{ tabId: 4, message: {} }])
  })

  it('keeps only the active tabs when the query asks for them', async () => {
    installFakeTabs([{ id: 3 }, { id: 4, active: true }])
    const tabs = await fakeBrowser.tabs.query({ active: true })
    expect(tabs.map(({ id }) => id)).toEqual([4])
  })

  it('keeps only the tabs of the focused window when the query asks for it', async () => {
    installFakeTabs([{ id: 3 }, { id: 4, windowId: OTHER_WINDOW_ID }], OTHER_WINDOW_ID)
    const tabs = await fakeBrowser.tabs.query({ lastFocusedWindow: true })
    expect(tabs.map(({ id }) => id)).toEqual([4])
  })
})

describe('changedIn', () => {
  it('is the data.changed message the fake tab receives', () => {
    expect(changedIn('a', 'b')).toEqual([
      { tabId: FAKE_TAB_ID, message: { type: 'data.changed', conversationIds: ['a', 'b'] } },
    ])
  })
})
