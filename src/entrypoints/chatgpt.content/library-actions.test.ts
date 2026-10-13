import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conversationLink, conversationUrl } from '@/chatgpt'
import { err, ok } from '@/errors'
import { highlightToMarkdown, renderMarkdown } from '@/markdown'
import { COPIED_MESSAGE, fieldOf, JSON_MEDIA_TYPE, type Snapshot } from '@/model'
import { createPainter } from '@/painter'
import {
  conversationHtml,
  documentWithLocation,
  type FakeBackground,
  type FakeDownloads,
  FIXED_TIME,
  FIXTURE_CHAT_PATH,
  FIXTURE_CONVERSATION_ID,
  installFakeBackground,
  installFakeClipboardWriter,
  installFakeDownload,
  installFakeHighlightApi,
  makeConversation,
  makeHighlight,
  makeOverlayRoot,
  mountFixture,
  OTHER_CONVERSATION_ID,
  settle,
  sidebarHtml,
  WRITE_FAILURE,
} from '@/testing'
import { exportFileName } from './download'
import { loadJump } from './jump'
import {
  COPY_FAILED_MESSAGE,
  createLibraryActions,
  importedMessage,
  READ_FAILED_MESSAGE,
} from './library-actions'
import { createStore, type Store } from './store'

const REPORT = { added: 2, updated: 1, skipped: 3 }

const here = makeHighlight({
  id: 'here',
  conversationId: FIXTURE_CONVERSATION_ID,
  note: 'Why tides',
  tags: ['moon'],
})
const there = makeHighlight({ id: 'there', conversationId: OTHER_CONVERSATION_ID })
const SNAPSHOT: Snapshot = {
  conversations: [
    makeConversation({ id: FIXTURE_CONVERSATION_ID, title: 'Tides' }),
    makeConversation({ id: OTHER_CONVERSATION_ID, title: 'Second chat' }),
  ],
  highlights: [here, there],
}

let store: Store
let background: FakeBackground
let downloads: FakeDownloads
let close: () => void
let closeInPlace: () => void
let track: () => void
let assign: (url: string) => void
let stand: Document

const actions = () => {
  const painter = createPainter(installFakeHighlightApi())
  const runtime = { doc: stand, store, painter, shadowRoot: makeOverlayRoot() }
  return createLibraryActions(runtime, { close, closeInPlace }, { track })
}

const lastToast = (): string | undefined => store.toast.value?.message

const fileWith = (text: string): File => new File([text], 'backup.json')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TIME)
  window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
  mountFixture(conversationHtml + sidebarHtml)
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
  store.library.value = { snapshot: SNAPSHOT, now: FIXED_TIME }
  background = installFakeBackground()
  close = vi.fn()
  closeInPlace = vi.fn()
  track = vi.fn()
  assign = vi.fn()
  stand = documentWithLocation(document, { assign })
})

describe('closeLibrary', () => {
  it('closes the view', () => {
    actions().closeLibrary()
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('jumpTo', () => {
  it('remembers the target for the reveal', () => {
    actions().jumpTo(there)
    expect(loadJump()).toEqual({ conversationId: OTHER_CONVERSATION_ID, highlightId: 'there' })
  })

  it('stays on the page for a highlight of this chat, closing the view in place', () => {
    actions().jumpTo(here)
    expect(closeInPlace).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith({
      conversationId: FIXTURE_CONVERSATION_ID,
      highlightId: 'here',
    })
    expect(assign).not.toHaveBeenCalled()
  })

  it('clicks the sidebar link of another conversation to navigate inside the app', () => {
    const clicks: Event[] = []
    const link = conversationLink(document, OTHER_CONVERSATION_ID)
    link?.addEventListener('click', (event) => {
      event.preventDefault()
      clicks.push(event)
    })
    actions().jumpTo(there)
    expect(clicks).toHaveLength(1)
    expect(assign).not.toHaveBeenCalled()
    expect(closeInPlace).not.toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith({
      conversationId: OTHER_CONVERSATION_ID,
      highlightId: 'there',
    })
  })

  it('assigns the conversation url when the sidebar has no link to it', () => {
    const unlisted = makeHighlight({ id: 'unlisted', conversationId: 'unlisted-chat' })
    actions().jumpTo(unlisted)
    expect(assign).toHaveBeenCalledWith(conversationUrl('unlisted-chat'))
    expect(track).not.toHaveBeenCalled()
  })
})

describe('jumpTo when the jump cannot be remembered', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
  })

  it('still closes the view for a highlight of the open conversation', () => {
    expect(() => actions().jumpTo(here)).not.toThrow()
    expect(closeInPlace).toHaveBeenCalledOnce()
    expect(track).toHaveBeenCalledOnce()
  })

  it('still navigates to another conversation through the sidebar', () => {
    const clicks: Event[] = []
    conversationLink(document, OTHER_CONVERSATION_ID)?.addEventListener('click', (event) => {
      event.preventDefault()
      clicks.push(event)
    })
    expect(() => actions().jumpTo(there)).not.toThrow()
    expect(clicks).toHaveLength(1)
  })

  it('still assigns the url when the sidebar has no link', () => {
    const unlisted = makeHighlight({ id: 'unlisted', conversationId: 'unlisted-chat' })
    expect(() => actions().jumpTo(unlisted)).not.toThrow()
    expect(assign).toHaveBeenCalledWith(conversationUrl('unlisted-chat'))
  })
})

describe('copyMarkdown', () => {
  it('puts the highlight on the clipboard as Markdown and says so', async () => {
    const written = installFakeClipboardWriter()
    actions().copyMarkdown(here)
    await settle()
    expect(written).toEqual([highlightToMarkdown(here)])
    expect(lastToast()).toBe(COPIED_MESSAGE)
  })

  it('says so when the clipboard refuses', async () => {
    installFakeClipboardWriter(() => Promise.reject(new Error('denied')))
    actions().copyMarkdown(here)
    await settle()
    expect(lastToast()).toBe(COPY_FAILED_MESSAGE)
  })
})

describe('exportMarkdown', () => {
  beforeEach(() => {
    downloads = installFakeDownload()
  })

  it('downloads the given highlights grouped by chat under a dated name', async () => {
    actions().exportMarkdown([here, there])
    expect(downloads.files[0]).toMatchObject({
      name: exportFileName('md', FIXED_TIME),
      type: 'text/markdown',
    })
    expect(await downloads.files[0]?.text()).toBe(
      renderMarkdown([
        { title: 'Tides', url: conversationUrl(FIXTURE_CONVERSATION_ID), highlights: [here] },
        {
          title: 'Second chat',
          url: conversationUrl(OTHER_CONVERSATION_ID),
          highlights: [there],
        },
      ]),
    )
  })

  it('exports only what it is given', async () => {
    actions().exportMarkdown([there])
    expect(await downloads.files[0]?.text()).not.toContain('Tides')
  })

  it('titles a chat the snapshot does not know by its address', async () => {
    store.library.value = null
    actions().exportMarkdown([here])
    expect(await downloads.files[0]?.text()).toContain(`## ${conversationUrl(here.conversationId)}`)
  })

  it('asks the background for nothing', () => {
    actions().exportMarkdown([here])
    expect(background.sent()).toEqual([])
  })
})

describe('exportBackup', () => {
  beforeEach(() => {
    downloads = installFakeDownload()
  })

  it('downloads the backup the background produced as a dated JSON file', async () => {
    background.answerWith(() => ok('{"format":"chatgpt-highlights"}'))
    actions().exportBackup()
    await settle()
    expect(background.sent()).toEqual([{ type: 'backup.export' }])
    expect(downloads.files[0]).toMatchObject({
      name: exportFileName('json', FIXED_TIME),
      type: JSON_MEDIA_TYPE,
    })
    expect(await downloads.files[0]?.text()).toBe('{"format":"chatgpt-highlights"}')
  })

  it('shows the error and downloads nothing when the export fails', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    actions().exportBackup()
    await settle()
    expect(lastToast()).toBe(WRITE_FAILURE.message)
    expect(downloads.files).toEqual([])
  })
})

describe('importBackup', () => {
  it('sends the file text and reports what was imported', async () => {
    background.answerWith(() => ok(REPORT))
    actions().importBackup(fileWith('{"backup":true}'))
    await settle()
    expect(background.sent()).toEqual([{ type: 'backup.import', text: '{"backup":true}' }])
    expect(lastToast()).toBe('Imported 2, updated 1, skipped 3')
    expect(lastToast()).toBe(importedMessage(REPORT))
  })

  it('shows the error when the backup is rejected', async () => {
    background.answerWith(() => err({ code: 'invalid_backup', message: 'Not a backup file' }))
    actions().importBackup(fileWith('nope'))
    await settle()
    expect(lastToast()).toBe('Not a backup file')
  })

  it('says so when the file cannot be read', async () => {
    const unreadable = new File([''], 'backup.json')
    vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('gone'))
    actions().importBackup(unreadable)
    await settle()
    expect(lastToast()).toBe(READ_FAILED_MESSAGE)
    expect(background.sent()).toEqual([])
  })
})

describe('purgeConversation', () => {
  it('asks the background to delete the chat and its highlights', async () => {
    background.answerWith(() => ok(null))
    actions().purgeConversation(OTHER_CONVERSATION_ID)
    await settle()
    expect(background.sent()).toEqual([
      { type: 'conversation.purge', conversationId: OTHER_CONVERSATION_ID },
    ])
    expect(store.toast.value).toBeNull()
  })

  it('shows the error when the purge fails', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    actions().purgeConversation(OTHER_CONVERSATION_ID)
    await settle()
    expect(lastToast()).toBe(WRITE_FAILURE.message)
    expect(fieldOf(background.sent()[0], 'type')).toBe('conversation.purge')
  })
})
