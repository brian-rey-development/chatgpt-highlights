import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPOSER, NATIVE_WAIT_MS } from '@/chatgpt'
import { LIMITS, TEMPORARY_CHAT_MESSAGE } from '@/model'
import { createPainter, type Painter, paint } from '@/painter'
import {
  addStopButton,
  askBoxHtml,
  conversationHtml,
  EMPTY_SNAPSHOT,
  ESCAPE_INIT,
  FIRST_ANSWER_ID,
  FIXTURE_CONVERSATION_ID,
  HIGH_TIDE_QUOTE,
  installFakeHighlightApi,
  installFakeRangeBox,
  LAST_ANSWER_ID,
  LATER_TIME,
  makeHighlight,
  makeOverlayRoot,
  mountFixture,
  nextFrame,
  PULL_QUOTE,
  rangeOfQuote,
  rangeOver,
  requireElement,
  requireUnit,
  selectRange,
  stubElementBox,
  typeInOverlay,
} from '@/testing'
import type { Stop } from './listen'
import { UI_NAME } from './overlay'
import { startSelection } from './selection'
import { createStore, type Store } from './store'

const SELECTION_BOX = new DOMRect(120, 100, 280, 20)
const ASK_BOX = new DOMRect(120, 64, 100, 30)
const PLACED_ASK_BOX = new DOMRect(150, 70, 102, 30)
const PRESS = { bubbles: true }

let store: Store
let overlayRoot: ShadowRoot
let painter: Painter
const stops: Stop[] = []

const selectQuote = (messageId: string, exact: string): void =>
  selectRange(rangeOfQuote(messageId, exact))

const begin = (): void => {
  overlayRoot = makeOverlayRoot()
  painter = createPainter(installFakeHighlightApi())
  const runtime = { doc: document, store, painter, shadowRoot: overlayRoot }
  stops.push(startSelection(runtime))
}

const overlayHost = (): Element => {
  const host = document.createElement(UI_NAME)
  document.body.append(host)
  return host
}

const release = async (target: Element = requireUnit(FIRST_ANSWER_ID).textRoot) => {
  target.dispatchEvent(new PointerEvent('pointerup', PRESS))
  await nextFrame()
}

const readyToSelect = async (): Promise<void> => {
  selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
  await release()
}

beforeEach(() => {
  vi.useFakeTimers()
  mountFixture(conversationHtml + askBoxHtml)
  installFakeRangeBox(SELECTION_BOX)
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('showing the pill', () => {
  it('appears above the first line of a selection inside one message text root', async () => {
    begin()
    await readyToSelect()
    expect(store.pill.value?.anchor).toBe(SELECTION_BOX)
  })

  it('waits for the next frame so the page can show its own ask box first', async () => {
    begin()
    selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    requireUnit(FIRST_ANSWER_ID).textRoot.dispatchEvent(new PointerEvent('pointerup', PRESS))
    expect(store.pill.value).toBeNull()
    await nextFrame()
    expect(store.pill.value).not.toBeNull()
  })

  it('docks to the page ask box when one is visible near the selection', async () => {
    stubElementBox(ASK_BOX)
    begin()
    await readyToSelect()
    expect(store.pill.value?.dock).toBe(ASK_BOX)
  })

  it('follows the page ask box when ChatGPT places it after the release', async () => {
    stubElementBox(ASK_BOX)
    begin()
    await readyToSelect()
    stubElementBox(PLACED_ASK_BOX)
    requireElement('.fixed').setAttribute('style', 'transform: translate(150px, 70px)')
    await Promise.resolve()
    expect(store.pill.value?.dock).toBe(PLACED_ASK_BOX)
  })

  it('docks to a page ask box that appears after the release', async () => {
    const fixed = requireElement('.fixed')
    fixed.setAttribute('hidden', '')
    begin()
    await readyToSelect()
    stubElementBox(ASK_BOX)
    fixed.removeAttribute('hidden')
    await Promise.resolve()
    expect(store.pill.value?.dock).toBe(ASK_BOX)
  })

  it('keeps the same pill when the page ask box changes without moving', async () => {
    stubElementBox(ASK_BOX)
    begin()
    await readyToSelect()
    const shown = store.pill.value
    requireElement('.fixed').setAttribute('style', 'opacity: 1')
    await Promise.resolve()
    expect(store.pill.value).toBe(shown)
  })

  it('does not bring back a pill something else dismissed while the box settles', async () => {
    stubElementBox(ASK_BOX)
    begin()
    await readyToSelect()
    store.pill.value = null
    stubElementBox(PLACED_ASK_BOX)
    requireElement('.fixed').setAttribute('style', 'transform: translate(150px, 70px)')
    await Promise.resolve()
    expect(store.pill.value).toBeNull()
  })

  it('stops following the page ask box once it has had time to settle', async () => {
    stubElementBox(ASK_BOX)
    begin()
    await readyToSelect()
    vi.advanceTimersByTime(NATIVE_WAIT_MS)
    stubElementBox(PLACED_ASK_BOX)
    requireElement('.fixed').setAttribute('style', 'transform: translate(150px, 70px)')
    await Promise.resolve()
    expect(store.pill.value?.dock).toBe(ASK_BOX)
  })

  it('keeps the pill hidden when the page scrolls before the next frame', async () => {
    begin()
    selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    requireUnit(FIRST_ANSWER_ID).textRoot.dispatchEvent(new PointerEvent('pointerup', PRESS))
    document.dispatchEvent(new Event('scroll'))
    await nextFrame()
    expect(store.pill.value).toBeNull()
  })

  it('does not dock when the page shows no ask box', async () => {
    requireElement('.fixed').setAttribute('hidden', '')
    begin()
    await readyToSelect()
    expect(store.pill.value?.dock).toBeNull()
  })

  it('moves to the new selection when the user selects again', async () => {
    begin()
    await readyToSelect()
    selectQuote(LAST_ANSWER_ID, HIGH_TIDE_QUOTE)
    await release()
    expect(store.pill.value).not.toBeNull()
  })
})

describe('not showing the pill', () => {
  it('stays hidden for a collapsed selection', async () => {
    begin()
    const range = rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot)
    range.collapse(true)
    selectRange(range)
    await release()
    expect(store.pill.value).toBeNull()
  })

  it('stays hidden for a selection across two messages', async () => {
    begin()
    const range = rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot)
    range.setEnd(requireUnit(LAST_ANSWER_ID).textRoot, 1)
    selectRange(range)
    await release()
    expect(store.pill.value).toBeNull()
  })

  it('stays hidden for a selection over the size limit', async () => {
    begin()
    const paragraph = requireElement('p', requireUnit(FIRST_ANSWER_ID).textRoot)
    paragraph.textContent = 'x'.repeat(LIMITS.quoteChars + 1)
    selectRange(rangeOver(paragraph))
    await release()
    expect(store.pill.value).toBeNull()
  })

  it('stays hidden for a selection inside the composer', async () => {
    begin()
    selectRange(rangeOver(requireElement(COMPOSER)))
    await release()
    expect(store.pill.value).toBeNull()
  })

  it('stays hidden for a selection over an existing highlight', async () => {
    begin()
    const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    paint(painter, { id: makeHighlight().id, range, color: 'yellow', hasNote: false })
    await readyToSelect()
    expect(store.pill.value).toBeNull()
  })

  it('stays hidden while a response is generating', async () => {
    addStopButton()
    begin()
    await readyToSelect()
    expect(store.pill.value).toBeNull()
  })

  it.each([
    {
      name: 'a popover is open',
      open: () => {
        store.popover.value = { highlight: makeHighlight(), anchor: SELECTION_BOX }
      },
    },
    {
      name: 'the Highlights view is open',
      open: () => {
        store.library.value = { snapshot: EMPTY_SNAPSHOT, now: LATER_TIME }
      },
    },
    {
      name: 'the page is not a conversation',
      open: () => {
        store.conversationId.value = null
      },
    },
  ])('stays hidden while $name', async ({ open }) => {
    open()
    begin()
    await readyToSelect()
    expect(store.pill.value).toBeNull()
  })

  it('ignores a release inside the extension overlay', async () => {
    begin()
    selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    await release(overlayHost())
    expect(store.pill.value).toBeNull()
  })
})

const TEMPORARY_ADDRESS = '?temporary-chat=true'

const goTo = (search: string): void => {
  history.replaceState(null, '', `/${search}`)
}

describe('temporary chats', () => {
  beforeEach(() => {
    goTo(TEMPORARY_ADDRESS)
  })

  afterEach(() => {
    goTo('')
  })

  it('offers no pill', async () => {
    begin()
    await readyToSelect()
    expect(store.pill.value).toBeNull()
  })

  it('says highlights are off on the first selection that would have offered a pill', async () => {
    begin()
    await readyToSelect()
    expect(store.toast.value?.message).toBe(TEMPORARY_CHAT_MESSAGE)
  })

  it('stays silent on later selections in the same tab', async () => {
    begin()
    await readyToSelect()
    expect(store.toast.value).not.toBeNull()
    store.toast.value = null
    await readyToSelect()
    expect(store.toast.value).toBeNull()
  })

  it('does not say anything when no pill would have been offered anyway', async () => {
    store.popover.value = { highlight: makeHighlight(), anchor: SELECTION_BOX }
    begin()
    await readyToSelect()
    expect(store.toast.value).toBeNull()
    store.popover.value = null
    await readyToSelect()
    expect(store.toast.value?.message).toBe(TEMPORARY_CHAT_MESSAGE)
  })

  it('does not say anything while the Highlights view is open', async () => {
    store.library.value = { snapshot: EMPTY_SNAPSHOT, now: LATER_TIME }
    begin()
    await readyToSelect()
    expect(store.toast.value).toBeNull()
  })

  it('offers the pill again once the address moves to a normal chat', async () => {
    begin()
    await readyToSelect()
    expect(store.toast.value).not.toBeNull()
    goTo('')
    await readyToSelect()
    expect(store.pill.value).not.toBeNull()
  })

  it('goes quiet again when the address returns to a temporary chat', async () => {
    begin()
    await readyToSelect()
    goTo('')
    await readyToSelect()
    store.toast.value = null
    goTo(TEMPORARY_ADDRESS)
    await readyToSelect()
    expect([store.pill.value, store.toast.value]).toEqual([null, null])
  })
})

describe('hiding the pill', () => {
  beforeEach(async () => {
    begin()
    await readyToSelect()
  })

  it('hides when anything scrolls', () => {
    requireUnit(FIRST_ANSWER_ID).element.dispatchEvent(new Event('scroll'))
    expect(store.pill.value).toBeNull()
  })

  it('hides on Escape typed on the page', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    expect(store.pill.value).toBeNull()
  })

  it('hides on Escape typed in the overlay', () => {
    typeInOverlay(overlayRoot, 'Escape')
    expect(store.pill.value).toBeNull()
  })

  it('hides on a pointerdown outside the overlay', () => {
    requireElement(COMPOSER).dispatchEvent(new PointerEvent('pointerdown', PRESS))
    expect(store.pill.value).toBeNull()
  })

  it('stays when the pointerdown lands on the overlay itself', () => {
    overlayHost().dispatchEvent(new PointerEvent('pointerdown', PRESS))
    expect(store.pill.value).not.toBeNull()
  })

  it('does not appear after a pointerdown that came between release and frame', async () => {
    store.pill.value = null
    requireUnit(FIRST_ANSWER_ID).textRoot.dispatchEvent(new PointerEvent('pointerup', PRESS))
    requireElement(COMPOSER).dispatchEvent(new PointerEvent('pointerdown', PRESS))
    await nextFrame()
    expect(store.pill.value).toBeNull()
  })
})

describe('closing the popover', () => {
  it.each([
    {
      name: 'on the page',
      press: () => document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT)),
    },
    { name: 'in the overlay', press: () => typeInOverlay(overlayRoot, 'Escape') },
  ])('closes on Escape typed $name', ({ press }) => {
    begin()
    store.popover.value = { highlight: makeHighlight(), anchor: SELECTION_BOX }
    press()
    expect(store.popover.value).toBeNull()
  })

  it('closes on a pointerdown outside the overlay and stays on one inside it', () => {
    begin()
    store.popover.value = { highlight: makeHighlight(), anchor: SELECTION_BOX }
    overlayHost().dispatchEvent(new PointerEvent('pointerdown', PRESS))
    expect(store.popover.value).not.toBeNull()
    requireElement(COMPOSER).dispatchEvent(new PointerEvent('pointerdown', PRESS))
    expect(store.popover.value).toBeNull()
  })
})

describe('stopping', () => {
  it('removes every listener and cancels a pending frame', async () => {
    begin()
    selectQuote(FIRST_ANSWER_ID, PULL_QUOTE)
    requireUnit(FIRST_ANSWER_ID).textRoot.dispatchEvent(new PointerEvent('pointerup', PRESS))
    for (const stop of stops.splice(0)) stop()
    await nextFrame()
    expect(store.pill.value).toBeNull()
    store.pill.value = { anchor: SELECTION_BOX, dock: null }
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    expect(store.pill.value).not.toBeNull()
  })
})
