import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPOSER } from '@/chatgpt'
import { createPainter, type Painter, unpaintAll } from '@/painter'
import {
  conversationHtml,
  FIRST_ANSWER_ID,
  FIRST_LINE_BOX,
  highlightIn,
  installFakeCaret,
  installFakeHighlightApi,
  installFakeRangeBox,
  makeOverlayRoot,
  mountFixture,
  PULL_QUOTE,
  rangeOfQuote,
  rangeOver,
  requireElement,
  requireUnit,
  selectRange,
} from '@/testing'
import { anchorUnits } from './anchor-pass'
import type { Stop } from './listen'
import { UI_NAME } from './overlay'
import { startPointer } from './pointer'
import { createStore, type Store } from './store'

const SECOND_LINE = new DOMRect(40, 110, 120, 20)
const ON_FIRST_LINE = { clientX: 100, clientY: 100 }
const ON_SECOND_LINE = { clientX: 100, clientY: 120 }

let painter: Painter
let store: Store
const stops: Stop[] = []

const saved = () => highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'saved' })

const begin = (): void => {
  const highlight = saved()
  store.highlights.value = new Map([[highlight.id, highlight]])
  anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
  stops.push(startPointer({ doc: document, store, painter, shadowRoot: makeOverlayRoot() }))
}

const pointAtQuote = (): void => {
  const range = rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE)
  installFakeCaret({ offsetNode: range.startContainer, offset: range.startOffset + 2 })
}

const click = (target: Element, init: MouseEventInit = ON_FIRST_LINE): void => {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))
}

const clickQuote = (init?: MouseEventInit): void =>
  click(requireUnit(FIRST_ANSWER_ID).textRoot, init)

beforeEach(() => {
  mountFixture(conversationHtml)
  installFakeRangeBox(FIRST_LINE_BOX, SECOND_LINE)
  painter = createPainter(installFakeHighlightApi())
  store = createStore()
  begin()
  pointAtQuote()
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('clicking painted text', () => {
  it('opens the popover for the highlight under the pointer', () => {
    clickQuote()
    expect(store.popover.value?.highlight).toEqual(saved())
    expect(store.popover.value?.anchor).toBe(FIRST_LINE_BOX)
  })

  it('anchors the popover to the line that was clicked', () => {
    clickQuote(ON_SECOND_LINE)
    expect(store.popover.value?.anchor).toBe(SECOND_LINE)
  })

  it('hides the selection pill', () => {
    store.pill.value = { anchor: FIRST_LINE_BOX, dock: null }
    clickQuote()
    expect(store.pill.value).toBeNull()
  })

  it('does nothing when the click is not on painted text', () => {
    installFakeCaret(null)
    clickQuote()
    expect(store.popover.value).toBeNull()
  })

  it('does nothing when the highlight under the pointer is unknown to the conversation', () => {
    store.highlights.value = new Map()
    clickQuote()
    expect(store.popover.value).toBeNull()
  })
})

describe('clicks that are not a plain click on a message', () => {
  it('ignores a click that ends a text selection', () => {
    selectRange(rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot))
    clickQuote()
    expect(store.popover.value).toBeNull()
  })

  it('opens the popover when the selection is only a caret', () => {
    const caret = rangeOver(requireUnit(FIRST_ANSWER_ID).textRoot)
    caret.collapse(true)
    selectRange(caret)
    clickQuote()
    expect(store.popover.value).not.toBeNull()
  })

  it('ignores the second click of a double click', () => {
    clickQuote({ ...ON_FIRST_LINE, detail: 2 })
    expect(store.popover.value).toBeNull()
  })

  it('ignores a click outside every message', () => {
    click(requireElement(COMPOSER))
    expect(store.popover.value).toBeNull()
  })

  it('ignores a click on the extension overlay', () => {
    const host = document.createElement(UI_NAME)
    document.body.append(host)
    click(host)
    expect(store.popover.value).toBeNull()
  })

  it('does not measure the pointer position when nothing is painted', () => {
    unpaintAll(painter)
    const measure = vi.spyOn(document, 'caretPositionFromPoint')
    clickQuote()
    expect(measure).not.toHaveBeenCalled()
    expect(store.popover.value).toBeNull()
  })
})

describe('stopping', () => {
  it('stops listening for clicks', () => {
    for (const stop of stops.splice(0)) stop()
    clickQuote()
    expect(store.popover.value).toBeNull()
  })
})
