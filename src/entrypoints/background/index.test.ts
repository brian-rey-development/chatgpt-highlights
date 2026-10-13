import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { fieldOf } from '@/model'
import {
  answerOf,
  changedIn,
  FAKE_TAB_ID,
  installFakeTabs,
  LIBRARY_OPEN,
  makeFakeTab,
  makeNewHighlight,
  type SentMessage,
} from '@/testing'
import background from './index'
import { PURGE_ALARM } from './purge'

let sent: SentMessage[]

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  sent = installFakeTabs([{ id: FAKE_TAB_ID }])
  background.main()
})

describe('background', () => {
  it('stores a highlight sent by a tab and answers it from the database', async () => {
    const input = makeNewHighlight()
    const created = await answerOf({ type: 'highlight.create', input })
    const loaded = await answerOf({
      type: 'conversation.load',
      conversationId: input.conversationId,
    })
    const highlights = fieldOf(fieldOf(loaded, 'data'), 'highlights')
    expect(fieldOf(created, 'ok')).toBe(true)
    expect(highlights).toEqual([fieldOf(created, 'data')])
  })

  it('rejects a message that is not a request', async () => {
    const answer = await answerOf({ type: 'highlight.create', input: {} })
    expect(fieldOf(fieldOf(answer, 'error'), 'code')).toBe('invalid_message')
  })

  it('tells every chatgpt tab which conversation a write touched', async () => {
    const input = makeNewHighlight()
    await answerOf({ type: 'highlight.create', input })
    await vi.waitFor(() => expect(sent).toEqual(changedIn(input.conversationId)))
  })

  it('opens the library in a chatgpt tab when the toolbar button is clicked', async () => {
    vi.spyOn(fakeBrowser.tabs, 'update').mockImplementation(async () => undefined)
    vi.spyOn(fakeBrowser.windows, 'update').mockImplementation(async () => undefined)
    await fakeBrowser.action.onClicked.trigger(makeFakeTab({ id: FAKE_TAB_ID }))
    expect(sent).toEqual([{ tabId: FAKE_TAB_ID, message: LIBRARY_OPEN }])
  })

  it('schedules the daily purge alarm', async () => {
    await vi.waitFor(async () => expect(await fakeBrowser.alarms.get(PURGE_ALARM)).toBeDefined())
  })
})
