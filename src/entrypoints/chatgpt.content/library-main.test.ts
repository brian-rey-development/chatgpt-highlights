import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INERT_ATTR, LIBRARY_ADDRESS, MAIN } from '@/chatgpt'
import { createPainter } from '@/painter'
import {
  conversationHtml,
  type FakeResizeObservers,
  FIXTURE_CHAT_PATH,
  homeHtml,
  installFakeHighlightApi,
  installFakeResizeObserver,
  makeOverlayRoot,
  mountFixture,
  requireElement,
  swapMain,
} from '@/testing'
import { followMain, type MainFollow } from './library-main'
import { createStore, type Store } from './store'

const CHAT_BOX = new DOMRect(260, 0, 900, 700)
const HOME_BOX = new DOMRect(0, 0, 1160, 700)

let store: Store
let observers: FakeResizeObservers
let boxes: Map<Element, DOMRect>

const chatMain = (): HTMLElement => requireElement<HTMLElement>(MAIN)

const follow = (first: HTMLElement): MainFollow => {
  const painter = createPainter(installFakeHighlightApi())
  const runtime = { doc: document, store, painter, shadowRoot: makeOverlayRoot() }
  return followMain(runtime, first)
}

const followChat = (): MainFollow => {
  boxes.set(chatMain(), CHAT_BOX)
  return follow(chatMain())
}

const swapToHome = (): HTMLElement => {
  const { visible } = swapMain(homeHtml)
  boxes.set(visible, HOME_BOX)
  return visible
}

const isInert = (main: Element): boolean => main.hasAttribute(INERT_ATTR)

beforeEach(() => {
  window.history.replaceState(null, '', LIBRARY_ADDRESS)
  mountFixture(conversationHtml)
  observers = installFakeResizeObserver()
  store = createStore()
  boxes = new Map()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return boxes.get(this) ?? new DOMRect()
  })
})

describe('followMain', () => {
  it('holds the main inert and publishes its frame', () => {
    followChat()
    expect(isInert(chatMain())).toBe(true)
    expect(store.libraryFrame.value).toBe(CHAT_BOX)
  })

  it('moves to the visible main when the page swaps it and the old one resizes', () => {
    followChat()
    const chat = chatMain()
    const home = swapToHome()
    observers.resize()
    expect(isInert(home)).toBe(true)
    expect(isInert(chat)).toBe(false)
    expect(store.libraryFrame.value).toBe(HOME_BOX)
  })

  it('moves to the visible main on a refresh, without a resize', () => {
    const following = followChat()
    const home = swapToHome()
    following.refresh()
    expect(isInert(home)).toBe(true)
    expect(store.libraryFrame.value).toBe(HOME_BOX)
  })

  it('watches the size of the visible main instead of the hidden one', () => {
    const following = followChat()
    const home = swapToHome()
    following.refresh()
    expect(observers.observed()).toEqual([home])
  })

  it('keeps the old main while no other main is visible', () => {
    const following = followChat()
    const chat = chatMain()
    swapToHome().hidden = true
    following.refresh()
    expect(isInert(chat)).toBe(true)
  })

  it('does not move to the next page once the address has left the view', () => {
    const following = followChat()
    const home = swapToHome()
    window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
    following.refresh()
    expect(isInert(home)).toBe(false)
    expect(store.libraryFrame.value).toBe(CHAT_BOX)
  })

  it('leaves an inert the page set on the main it moves away from', () => {
    chatMain().setAttribute(INERT_ATTR, '')
    const following = follow(chatMain())
    const chat = chatMain()
    swapToHome()
    following.refresh()
    expect(isInert(chat)).toBe(true)
  })

  it('puts the page back as it found it when it stops', () => {
    const following = followChat()
    const chat = chatMain()
    const home = swapToHome()
    following.refresh()
    following.stop()
    expect(isInert(home)).toBe(false)
    expect(isInert(chat)).toBe(false)
    expect(observers.observed()).toEqual([])
  })
})
