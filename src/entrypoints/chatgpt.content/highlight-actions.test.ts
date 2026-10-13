import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeQuote, readMessageText } from '@/anchoring'
import * as chatgpt from '@/chatgpt'
import { COMPOSER, IGNORED_TEXT_SELECTOR, NATIVE_WAIT_MS } from '@/chatgpt'
import { err, ok } from '@/errors'
import { fieldOf, type Highlight } from '@/model'
import { createPainter, type Painter } from '@/painter'
import {
  askBoxHtml,
  conversationHtml,
  EMPTY_SNAPSHOT,
  type FakeBackground,
  FIRST_ANSWER_ID,
  FIRST_LINE_BOX,
  FIXED_TIME,
  FIXTURE_CONVERSATION_ID,
  FRAME_MS,
  highlightIn,
  installFakeBackground,
  installFakeClipboard,
  installFakeHighlightApi,
  installFakeRangeBox,
  makeHighlight,
  makeOverlayRoot,
  mountFixture,
  OTHER_CONVERSATION_ID,
  PULL_QUOTE,
  paintedTexts,
  rangeOfQuote,
  recordPastes,
  requireElement,
  requireUnit,
  selectRange,
  settle,
  stubElementBox,
  WRITE_FAILURE,
} from '@/testing'
import { anchorUnits } from './anchor-pass'
import { COMPOSER_FAILED_MESSAGE, createHighlightActions } from './highlight-actions'
import type { Stop } from './listen'
import { startSelection } from './selection'
import { createStore, type Store } from './store'

const TITLE = 'Tides'

let painter: Painter
let store: Store
let background: FakeBackground
let saved: Highlight
const stops: Stop[] = []

const closeLibrary = (): Promise<void> => {
  store.library.value = null
  return Promise.resolve()
}

const actions = () =>
  createHighlightActions(
    { doc: document, store, painter, shadowRoot: makeOverlayRoot() },
    { close: closeLibrary },
  )

const selectPullQuote = (): void => selectRange(rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE))

beforeEach(() => {
  vi.useFakeTimers()
  document.title = TITLE
  mountFixture(conversationHtml)
  installFakeRangeBox(FIRST_LINE_BOX)
  painter = createPainter(installFakeHighlightApi())
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
  background = installFakeBackground()
  saved = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'saved', color: 'green' })
  background.answerWith(() => ok(saved))
})

describe('highlightSelection', () => {
  it('paints the selection at once and clears it', () => {
    background.hold()
    selectPullQuote()
    store.pill.value = { anchor: FIRST_LINE_BOX, dock: null }
    actions().highlightSelection('green', false)
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
    expect(painter.painted.values().next().value).toMatchObject({ color: 'green', hasNote: false })
    expect(document.getSelection()?.isCollapsed).toBe(true)
    expect(store.pill.value).toBeNull()
  })

  it('sends the quote with the conversation title', async () => {
    selectPullQuote()
    actions().highlightSelection('green', false)
    await settle()
    const message = readMessageText(requireUnit(FIRST_ANSWER_ID).textRoot, IGNORED_TEXT_SELECTOR)
    const start = message.text.indexOf(PULL_QUOTE)
    expect(background.sent('highlight.create')).toEqual([
      {
        type: 'highlight.create',
        input: {
          conversationId: FIXTURE_CONVERSATION_ID,
          conversationTitle: TITLE,
          messageId: FIRST_ANSWER_ID,
          quote: describeQuote(message.text, { start, end: start + PULL_QUOTE.length }),
          color: 'green',
          note: '',
        },
      },
    ])
  })

  it('swaps the placeholder for the saved highlight', async () => {
    selectPullQuote()
    actions().highlightSelection('green', false)
    await settle()
    expect([...painter.painted.keys()]).toEqual([saved.id])
    expect(store.highlights.value.get(saved.id)).toEqual(saved)
    expect(store.popover.value).toBeNull()
  })

  it('opens the popover on the new highlight when a note is wanted', async () => {
    selectPullQuote()
    actions().highlightSelection('yellow', true)
    await settle()
    expect(store.popover.value).toEqual({ highlight: saved, anchor: FIRST_LINE_BOX })
  })

  it('unpaints and shows the error when the highlight cannot be saved', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    selectPullQuote()
    actions().highlightSelection('green', true)
    await settle()
    expect(painter.painted.size).toBe(0)
    expect(store.highlights.value.size).toBe(0)
    expect(store.popover.value).toBeNull()
    expect(store.toast.value?.message).toBe(WRITE_FAILURE.message)
  })

  it('does not adopt a highlight saved for a conversation the user has left', async () => {
    const gate = background.hold()
    selectPullQuote()
    actions().highlightSelection('green', true)
    store.conversationId.value = OTHER_CONVERSATION_ID
    gate.resolve(ok(saved))
    await settle()
    expect(store.highlights.value.size).toBe(0)
    expect(store.popover.value).toBeNull()
  })

  it('does nothing without a usable selection', async () => {
    actions().highlightSelection('green', false)
    await settle()
    expect(background.sent()).toEqual([])
    expect(painter.painted.size).toBe(0)
  })

  it('does nothing away from a conversation', async () => {
    store.conversationId.value = null
    selectPullQuote()
    actions().highlightSelection('green', false)
    await settle()
    expect(background.sent()).toEqual([])
    expect(painter.painted.size).toBe(0)
  })
})

describe('askAbout', () => {
  const paintSaved = (): void => {
    store.highlights.value = new Map([[saved.id, saved]])
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
  }

  it('hands the painted range and the note to ChatGPT, then closes the popover', async () => {
    const ask = vi.spyOn(chatgpt, 'askAbout').mockResolvedValue('native')
    paintSaved()
    store.popover.value = { highlight: saved, anchor: FIRST_LINE_BOX }
    actions().askAbout({ ...saved, note: 'Why tides' })
    await settle()
    expect(ask).toHaveBeenCalledWith(document, {
      range: painter.painted.get(saved.id)?.range,
      note: 'Why tides',
    })
    expect(store.popover.value).toBeNull()
    expect(store.toast.value).toBeNull()
  })

  it('accepts the pasted fallback like a native hand-off', async () => {
    vi.spyOn(chatgpt, 'askAbout').mockResolvedValue('pasted')
    paintSaved()
    actions().askAbout(saved)
    await settle()
    expect(store.toast.value).toBeNull()
  })

  it('says so when ChatGPT cannot take the quote, and keeps the popover', async () => {
    vi.spyOn(chatgpt, 'askAbout').mockResolvedValue('failed')
    paintSaved()
    store.popover.value = { highlight: saved, anchor: FIRST_LINE_BOX }
    actions().askAbout(saved)
    await settle()
    expect(store.toast.value?.message).toBe(COMPOSER_FAILED_MESSAGE)
    expect(store.popover.value).not.toBeNull()
  })

  it('closes the open library before handing a painted highlight to ChatGPT', async () => {
    let libraryWasOpen = true
    vi.spyOn(chatgpt, 'askAbout').mockImplementation(async () => {
      libraryWasOpen = store.library.value !== null
      return 'native'
    })
    paintSaved()
    store.library.value = { snapshot: EMPTY_SNAPSHOT, now: FIXED_TIME }
    actions().askAbout(saved)
    await settle()
    expect(libraryWasOpen).toBe(false)
  })
})

describe('askAbout from the Highlights view on a highlight painted in this chat', () => {
  const askWithSelectionWatched = async (html = conversationHtml + askBoxHtml): Promise<void> => {
    mountFixture(html)
    stubElementBox(FIRST_LINE_BOX)
    store.highlights.value = new Map([[saved.id, saved]])
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    const runtime = { doc: document, store, painter, shadowRoot: makeOverlayRoot() }
    stops.push(startSelection(runtime))
    actions().askAbout(saved)
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS + FRAME_MS)
  }

  afterEach(() => {
    for (const stop of stops.splice(0)) stop()
  })

  it('offers no pill for the painted highlight it re-selects', async () => {
    await askWithSelectionWatched()
    expect(store.pill.value).toBeNull()
  })

  it('leaves the quote unselected on the page', async () => {
    await askWithSelectionWatched()
    expect(document.getSelection()?.isCollapsed).toBe(true)
  })

  it('keeps the caret the composer took when the quote was pasted', async () => {
    installFakeClipboard()
    await askWithSelectionWatched(conversationHtml)
    const caret = document.getSelection()?.anchorNode ?? null
    expect(requireElement(COMPOSER).contains(caret)).toBe(true)
  })
})

describe('askAbout a highlight that is not painted in this chat', () => {
  beforeEach(() => installFakeClipboard())

  it('pastes its quote and note into the composer without the native hand-off', async () => {
    const ask = vi.spyOn(chatgpt, 'askAbout')
    const pasted = recordPastes(requireElement(COMPOSER))
    store.popover.value = { highlight: saved, anchor: FIRST_LINE_BOX }
    actions().askAbout({ ...saved, note: 'Why tides' })
    await settle()
    expect(pasted).toEqual([`> ${PULL_QUOTE}\n\nWhy tides`])
    expect(ask).not.toHaveBeenCalled()
    expect(store.toast.value).toBeNull()
    expect(store.popover.value).toBeNull()
  })

  it('closes the open library before it pastes', async () => {
    const libraryOpenAtPaste: boolean[] = []
    requireElement(COMPOSER).addEventListener('paste', () => {
      libraryOpenAtPaste.push(store.library.value !== null)
    })
    store.library.value = { snapshot: EMPTY_SNAPSHOT, now: FIXED_TIME }
    actions().askAbout(saved)
    await settle()
    expect(libraryOpenAtPaste).toEqual([false])
  })

  it('says so when the composer is missing', async () => {
    requireElement(COMPOSER).remove()
    actions().askAbout(saved)
    await settle()
    expect(store.toast.value?.message).toBe(COMPOSER_FAILED_MESSAGE)
  })
})

describe('the rest of the actions', () => {
  it('closePopover empties the popover', () => {
    store.popover.value = { highlight: makeHighlight(), anchor: FIRST_LINE_BOX }
    actions().closePopover()
    expect(store.popover.value).toBeNull()
  })

  it('dismissToast empties the toast', () => {
    store.toast.value = { id: 1, message: 'Saved', action: null }
    actions().dismissToast()
    expect(store.toast.value).toBeNull()
  })

  it('updateHighlight and removeHighlight go to the background', async () => {
    store.highlights.value = new Map([[saved.id, saved]])
    actions().updateHighlight(saved.id, { note: 'Why' })
    actions().removeHighlight(saved.id)
    await settle()
    expect(background.sent().map((message) => fieldOf(message, 'type'))).toEqual([
      'highlight.update',
      'highlight.delete',
    ])
  })
})
