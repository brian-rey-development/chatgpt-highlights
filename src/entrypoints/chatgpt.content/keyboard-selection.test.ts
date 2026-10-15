import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPainter } from '@/painter'
import { conversationHtml, installFakeHighlightApi, makeOverlayRoot, mountFixture } from '@/testing'
import { startKeyboardSelection } from './keyboard-selection'
import type { Stop } from './listen'
import { UI_NAME } from './overlay'
import { createStore, type Store } from './store'

const PILL_ANCHOR = new DOMRect(10, 10, 100, 20)
const PRESS = { bubbles: true }

let store: Store
let overlayRoot: ShadowRoot
let onSelect: ReturnType<typeof vi.fn<() => void>>
const stops: Stop[] = []

const begin = (): void => {
  overlayRoot = makeOverlayRoot()
  const painter = createPainter(installFakeHighlightApi())
  const runtime = { doc: document, store, painter, shadowRoot: overlayRoot }
  stops.push(startKeyboardSelection(runtime, onSelect))
}

const showPillButtons = (): HTMLButtonElement => {
  store.pill.value = { anchor: PILL_ANCHOR, dock: null }
  const toolbar = document.createElement('div')
  toolbar.setAttribute('role', 'toolbar')
  const first = document.createElement('button')
  toolbar.append(first, document.createElement('button'))
  overlayRoot.append(toolbar)
  return first
}

const pressTab = (init: KeyboardEventInit = {}, target: Element = document.body): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, ...PRESS, ...init })
  target.dispatchEvent(event)
  return event
}

const changeSelection = (): void => {
  document.dispatchEvent(new Event('selectionchange'))
}

beforeEach(() => {
  mountFixture(conversationHtml)
  store = createStore()
  onSelect = vi.fn()
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('selections made without the pointer', () => {
  it('reports a change of the selection', () => {
    begin()
    changeSelection()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it.each([
    { name: 'released', end: 'pointerup' },
    { name: 'cancelled', end: 'pointercancel' },
  ])('reports changes again once the pointer is $name', ({ end }) => {
    begin()
    document.body.dispatchEvent(new PointerEvent('pointerdown', PRESS))
    changeSelection()
    expect(onSelect).not.toHaveBeenCalled()
    document.body.dispatchEvent(new PointerEvent(end, PRESS))
    changeSelection()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('stops listening when stopped', () => {
    begin()
    for (const stop of stops.splice(0)) stop()
    changeSelection()
    pressTab()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('reaching the pill with Tab', () => {
  it('moves focus to the first pill button and keeps the page from tabbing on', () => {
    begin()
    const first = showPillButtons()
    const event = pressTab()
    expect(overlayRoot.activeElement).toBe(first)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves Tab alone while no pill is shown', () => {
    begin()
    expect(pressTab().defaultPrevented).toBe(false)
  })

  it('leaves Tab alone when the shown pill has no buttons yet', () => {
    begin()
    store.pill.value = { anchor: PILL_ANCHOR, dock: null }
    expect(pressTab().defaultPrevented).toBe(false)
  })

  it.each([
    { name: 'Shift', init: { shiftKey: true } },
    { name: 'Ctrl', init: { ctrlKey: true } },
    { name: 'Alt', init: { altKey: true } },
    { name: 'Meta', init: { metaKey: true } },
    { name: 'another key', init: { key: 'a' } },
  ])('leaves $name alone', ({ init }) => {
    begin()
    showPillButtons()
    expect(pressTab(init).defaultPrevented).toBe(false)
  })

  it('leaves Tab typed in the overlay to move between the pill buttons', () => {
    begin()
    showPillButtons()
    const host = document.createElement(UI_NAME)
    document.body.append(host)
    expect(pressTab({}, host).defaultPrevented).toBe(false)
  })
})
