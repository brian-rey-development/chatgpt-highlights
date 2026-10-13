import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureSidebarItem,
  HISTORY_LINK,
  INERT_ATTR,
  LIBRARY_ADDRESS,
  LIBRARY_HASH,
  MAIN,
  mainPane,
  NAV_ATTR,
  OPEN_ATTR,
  SIDEBAR_DESTINATION,
} from '@/chatgpt'
import { err, ok } from '@/errors'
import type { Snapshot } from '@/model'
import { createPainter } from '@/painter'
import {
  conversationHtml,
  deliverMessage,
  EMPTY_SNAPSHOT,
  ESCAPE_INIT,
  type FakeBackground,
  type FakeResizeObservers,
  type FakeSettle,
  FIXTURE_CHAT_PATH,
  FIXTURE_CONVERSATION_ID,
  FIXTURE_DATA_CHANGED,
  fakeSettle,
  homeHtml,
  installFakeBackground,
  installFakeHighlightApi,
  installFakeResizeObserver,
  LATER_TIME,
  LIBRARY_OPEN,
  MAIN_NAV,
  makeConversation,
  makeHighlight,
  makeOverlayRoot,
  mountFixture,
  nextFrame,
  OFFLINE_FAILURE,
  OTHER_CONVERSATION_ID,
  RAIL_NAV,
  requireElement,
  settle,
  sidebarHtml,
  stubElementBox,
  swapMain,
  typeInOverlay,
} from '@/testing'
import { type LibraryHost, startLibraryHost } from './library-host'
import { createStore, LOAD_FAILED_MESSAGE, type Store } from './store'

const MAIN_BOX = new DOMRect(260, 0, 900, 700)
const WIDER_MAIN_BOX = new DOMRect(0, 0, 1160, 700)
const HISTORY_WAIT_MS = 200
const SETTLES_WITH_ITEM_IN_PLACE = 10
const SNAPSHOT: Snapshot = {
  conversations: [makeConversation({ id: FIXTURE_CONVERSATION_ID })],
  highlights: [makeHighlight({ conversationId: FIXTURE_CONVERSATION_ID })],
}

let store: Store
let background: FakeBackground
let observers: FakeResizeObservers
let hooks: FakeSettle
let overlayRoot: ShadowRoot
let host: LibraryHost | null = null
let snapshotCalls = 0
let nativeCount = 0

const mainElement = (): HTMLElement => requireElement<HTMLElement>(MAIN)

const begin = (): LibraryHost => {
  overlayRoot = makeOverlayRoot()
  const painter = createPainter(installFakeHighlightApi())
  const runtime = { doc: document, store, painter, shadowRoot: overlayRoot }
  host = startLibraryHost(runtime, hooks.afterSettle)
  return host
}

const pause = (): Promise<void> =>
  new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      window.removeEventListener('popstate', done)
      resolve()
    }
    const timer = setTimeout(done, HISTORY_WAIT_MS)
    window.addEventListener('popstate', done)
  })

const withRealTimers = async (action: () => void): Promise<void> => {
  vi.useRealTimers()
  action()
  await pause()
}

const sidebarItem = (): HTMLElement => {
  const item = ensureSidebarItem(document, () => undefined)
  if (!item) throw new Error('no sidebar item')
  return item
}

const opened = async (): Promise<LibraryHost> => {
  const started = begin()
  hooks.settle()
  sidebarItem().click()
  await settle()
  return started
}

const clickWithoutNavigating = (selector: string): void => {
  const target = requireElement(selector)
  target.addEventListener('click', (event) => event.preventDefault())
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

const swapVisibleNav = (): void => {
  for (const nav of document.querySelectorAll(`${MAIN_NAV}, ${RAIL_NAV}`)) {
    nav.toggleAttribute('hidden')
  }
  for (const button of document.querySelectorAll(SIDEBAR_DESTINATION)) {
    button.removeAttribute('hidden')
  }
}

const destinationCount = (): number => document.querySelectorAll(SIDEBAR_DESTINATION).length

const isOpen = (): boolean => store.library.value !== null

const addressBar = (): string => `${window.location.pathname}${window.location.hash}`

const pageIsMarkedOpen = (): boolean =>
  document.documentElement.hasAttribute(OPEN_ATTR) && mainElement().hasAttribute(INERT_ATTR)

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
  mountFixture(conversationHtml + sidebarHtml)
  stubElementBox(MAIN_BOX)
  observers = installFakeResizeObserver()
  hooks = fakeSettle()
  nativeCount = destinationCount()
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
  snapshotCalls = 0
  background = installFakeBackground()
  background.answerWith(() => {
    snapshotCalls += 1
    return ok(snapshotCalls === 1 ? SNAPSHOT : EMPTY_SNAPSHOT)
  })
})

afterEach(() => {
  host?.stop()
  host = null
})

describe('the sidebar item', () => {
  it('is inserted by the first flush and put back when React drops it', () => {
    begin()
    hooks.settle()
    expect(destinationCount()).toBe(nativeCount + 1)
    sidebarItem().remove()
    hooks.settle()
    expect(destinationCount()).toBe(nativeCount + 1)
  })

  it('moves to the other nav when the one holding it is hidden', () => {
    begin()
    hooks.settle()
    swapVisibleNav()
    hooks.settle()
    expect(requireElement(`[${NAV_ATTR}]`).checkVisibility()).toBe(true)
    expect(destinationCount()).toBe(nativeCount + 1)
  })

  it('moves to the other nav when the one holding it is hidden, without a flush', async () => {
    begin()
    hooks.settle()
    swapVisibleNav()
    observers.resize()
    await nextFrame()
    expect(requireElement(`[${NAV_ATTR}]`).checkVisibility()).toBe(true)
  })

  it.each([
    { name: 'once', resizes: 1 },
    { name: 'twice in one frame', resizes: 2 },
  ])('does not put the item back after stop when its box changed $name', async ({ resizes }) => {
    begin()
    hooks.settle()
    swapVisibleNav()
    for (let count = 0; count < resizes; count += 1) observers.resize()
    host?.stop()
    host = null
    await nextFrame()
    expect(document.querySelector(`[${NAV_ATTR}]`)).toBeNull()
  })

  it('does not query the page while its item is in place', () => {
    begin()
    hooks.settle()
    const query = vi.spyOn(document, 'querySelector')
    const queryAll = vi.spyOn(document, 'querySelectorAll')
    for (let run = 0; run < SETTLES_WITH_ITEM_IN_PLACE; run += 1) hooks.settle()
    expect(query).not.toHaveBeenCalled()
    expect(queryAll).not.toHaveBeenCalled()
  })

  it('opens the view when clicked', async () => {
    await opened()
    expect(isOpen()).toBe(true)
  })

  it('opens the view on the library.open tab command', async () => {
    begin()
    await deliverMessage(LIBRARY_OPEN)
    await settle()
    expect(isOpen()).toBe(true)
  })
})

describe('opening', () => {
  it('pushes #highlights once, marks the page and loads one snapshot', async () => {
    const before = window.history.length
    const started = await opened()
    started.open()
    await settle()
    expect(addressBar()).toBe(LIBRARY_ADDRESS)
    expect(window.history.length).toBe(before + 1)
    expect(pageIsMarkedOpen()).toBe(true)
    expect(background.sent('library.snapshot')).toHaveLength(1)
    expect(store.library.value?.snapshot).toEqual(SNAPSHOT)
  })

  it('pushes the same address when it opens from the home page', async () => {
    window.history.replaceState(null, '', '/')
    store.conversationId.value = null
    const before = window.history.length
    await opened()
    expect(addressBar()).toBe(LIBRARY_ADDRESS)
    expect(window.history.length).toBe(before + 1)
  })

  it('records the chat it opened over', async () => {
    await opened()
    expect(store.libraryOver.value).toBe(FIXTURE_CONVERSATION_ID)
  })

  it('records no chat when it opened from the home page', async () => {
    window.history.replaceState(null, '', '/')
    store.conversationId.value = null
    await opened()
    expect(store.libraryOver.value).toBeNull()
  })

  it('stamps the snapshot with the time it was loaded', async () => {
    vi.setSystemTime(LATER_TIME)
    await opened()
    expect(store.library.value?.now).toBe(LATER_TIME)
  })

  it('places the view over main and follows its size', async () => {
    await opened()
    expect(store.libraryFrame.value).toBe(MAIN_BOX)
    expect(observers.observed()).toContain(mainElement())
    stubElementBox(WIDER_MAIN_BOX)
    observers.resize()
    expect(store.libraryFrame.value).toBe(WIDER_MAIN_BOX)
  })

  it('closes the selection pill and the popover', async () => {
    store.pill.value = { anchor: MAIN_BOX, dock: null }
    store.popover.value = { highlight: makeHighlight(), anchor: MAIN_BOX }
    await opened()
    expect(store.pill.value).toBeNull()
    expect(store.popover.value).toBeNull()
  })

  it('does nothing while the page has no main pane', () => {
    mountFixture('<p>loading</p>')
    const started = begin()
    started.open()
    expect(isOpen()).toBe(false)
    expect(window.location.hash).toBe('')
  })
})

describe('when ChatGPT keeps the old main hidden after an in-app navigation', () => {
  const isInert = (main: Element | null): boolean => main?.hasAttribute(INERT_ATTR) === true

  it('opens over the visible main', async () => {
    const { hidden, visible } = swapMain(homeHtml)
    await opened()
    expect(isInert(visible)).toBe(true)
    expect(isInert(hidden)).toBe(false)
    expect(observers.observed()).toContain(visible)
    expect(observers.observed()).not.toContain(hidden)
  })

  it('moves to the visible main when the page swaps it while the view is open', async () => {
    await opened()
    const { hidden, visible } = swapMain(homeHtml)
    hooks.settle()
    expect(isInert(visible)).toBe(true)
    expect(isInert(hidden)).toBe(false)
    expect(observers.observed()).toContain(visible)
    expect(observers.observed()).not.toContain(hidden)
  })

  it('moves to the visible main when the old one shrinks to nothing', async () => {
    await opened()
    const { visible } = swapMain(homeHtml)
    observers.resize()
    expect(isInert(visible)).toBe(true)
  })

  it('leaves no main inert once the view closes', async () => {
    await opened()
    swapMain(homeHtml)
    hooks.settle()
    host?.close()
    await settle()
    expect(document.querySelectorAll(`${MAIN}[${INERT_ATTR}]`)).toHaveLength(0)
    expect(isInert(mainPane(document))).toBe(false)
  })
})

describe('a #highlights URL on load', () => {
  beforeEach(() => window.history.replaceState(null, '', LIBRARY_ADDRESS))

  it('opens the view without pushing another entry', async () => {
    const before = window.history.length
    begin()
    await settle()
    expect(isOpen()).toBe(true)
    expect(window.history.length).toBe(before)
  })

  it('waits for the page to render its main pane', async () => {
    mountFixture('<p>loading</p>')
    begin()
    await settle()
    expect(isOpen()).toBe(false)
    mountFixture(conversationHtml + sidebarHtml)
    hooks.settle()
    await settle()
    expect(isOpen()).toBe(true)
  })

  it('stops waiting once the user went elsewhere', async () => {
    mountFixture('<p>loading</p>')
    begin()
    window.history.replaceState(null, '', '/')
    mountFixture(conversationHtml + sidebarHtml)
    hooks.settle()
    await settle()
    expect(isOpen()).toBe(false)
  })

  it("keeps the page's history state when it drops the hash", async () => {
    window.history.replaceState({ idx: 3 }, '', LIBRARY_ADDRESS)
    const started = begin()
    await settle()
    started.close()
    expect(window.history.state).toEqual({ idx: 3 })
  })

  it('goes back to the plain URL when closed, instead of leaving the page', async () => {
    const started = begin()
    await settle()
    const before = window.history.length
    started.close()
    expect(addressBar()).toBe('/')
    expect(window.history.length).toBe(before)
  })

  it('drops only the hash from an older address that still carries a chat path', async () => {
    window.history.replaceState(null, '', `${FIXTURE_CHAT_PATH}${LIBRARY_HASH}`)
    const started = begin()
    await settle()
    started.close()
    expect(addressBar()).toBe(FIXTURE_CHAT_PATH)
  })

  it('lets the session follow the page when it opens from an existing entry', async () => {
    window.history.replaceState(null, '', `${FIXTURE_CHAT_PATH}${LIBRARY_HASH}`)
    store.libraryOver.value = OTHER_CONVERSATION_ID
    begin()
    await settle()
    expect(store.libraryOver.value).toBeNull()
  })
})

describe('closing in place', () => {
  it('replaces the pushed entry instead of going back', async () => {
    await opened()
    const back = vi.spyOn(window.history, 'back')
    host?.closeInPlace()
    expect(isOpen()).toBe(false)
    expect(addressBar()).toBe(FIXTURE_CHAT_PATH)
    expect(back).not.toHaveBeenCalled()
  })

  it('keeps the entries below the view as they were', async () => {
    const before = window.history.length
    await opened()
    host?.closeInPlace()
    expect(window.history.length).toBe(before + 1)
    await withRealTimers(() => window.history.back())
    expect(window.location.pathname).toBe(FIXTURE_CHAT_PATH)
  })

  it('leaves the address alone when it no longer holds #highlights', async () => {
    await opened()
    window.history.replaceState(null, '', '/c/elsewhere')
    host?.closeInPlace()
    expect(addressBar()).toBe('/c/elsewhere')
  })
})

describe('closing', () => {
  it.each([
    {
      name: 'Escape on the page',
      close: () => document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT)),
    },
    { name: 'Escape typed in the overlay', close: () => typeInOverlay(overlayRoot, 'Escape') },
    { name: 'the closeLibrary action', close: () => host?.close() },
  ])('closes on $name and takes the pushed entry back', async ({ close }) => {
    await opened()
    await withRealTimers(close)
    expect(isOpen()).toBe(false)
    expect(addressBar()).toBe(FIXTURE_CHAT_PATH)
  })

  it('takes the pushed entry back to the home page when it opened from there', async () => {
    window.history.replaceState(null, '', '/')
    store.conversationId.value = null
    await opened()
    await withRealTimers(() => host?.close())
    expect(addressBar()).toBe('/')
  })

  it('leaves the history alone when the address no longer holds #highlights', async () => {
    await opened()
    const back = vi.spyOn(window.history, 'back')
    window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
    host?.close()
    expect(isOpen()).toBe(false)
    expect(back).not.toHaveBeenCalled()
  })

  it('closes on Back', async () => {
    await opened()
    await withRealTimers(() => window.history.back())
    expect(isOpen()).toBe(false)
    expect(window.location.pathname).toBe(FIXTURE_CHAT_PATH)
  })

  it('closes when the conversation changes', async () => {
    await opened()
    window.history.pushState(null, '', `/c/${OTHER_CONVERSATION_ID}`)
    store.conversationId.value = OTHER_CONVERSATION_ID
    expect(isOpen()).toBe(false)
  })

  it('closes when the address drops #highlights while the chat stays the same', async () => {
    window.history.replaceState(null, '', '/')
    store.conversationId.value = null
    await opened()
    window.history.pushState(null, '', '/')
    hooks.settle()
    expect(isOpen()).toBe(false)
  })

  it('closes when the user leaves for the home page', async () => {
    await opened()
    window.history.pushState(null, '', '/')
    store.conversationId.value = null
    expect(isOpen()).toBe(false)
  })

  it.each([
    { name: 'a chat in the history', selector: HISTORY_LINK },
    { name: 'another sidebar destination', selector: `${MAIN_NAV} ${SIDEBAR_DESTINATION}` },
  ])('closes on a click on $name', async ({ selector }) => {
    await opened()
    clickWithoutNavigating(selector)
    expect(isOpen()).toBe(false)
  })

  it('stays open on a click anywhere else, and on its own sidebar item', async () => {
    await opened()
    mainElement().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    sidebarItem().click()
    expect(isOpen()).toBe(true)
  })

  it('leaves an inert the page set itself', async () => {
    mainElement().setAttribute(INERT_ATTR, '')
    await opened()
    host?.close()
    await settle()
    expect(mainElement().hasAttribute(INERT_ATTR)).toBe(true)
  })

  it('removes everything opening added', async () => {
    await opened()
    host?.close()
    await settle()
    expect(pageIsMarkedOpen()).toBe(false)
    expect(document.documentElement.hasAttribute(OPEN_ATTR)).toBe(false)
    expect(mainElement().hasAttribute(INERT_ATTR)).toBe(false)
    expect(store.library.value).toBeNull()
    expect(store.libraryFrame.value).toBeNull()
    expect(observers.observed()).not.toContain(mainElement())
  })

  it('stops listening once closed', async () => {
    await opened()
    host?.close()
    await settle()
    const requests = background.sent().length
    await deliverMessage(FIXTURE_DATA_CHANGED)
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    store.conversationId.value = OTHER_CONVERSATION_ID
    await settle()
    expect(background.sent()).toHaveLength(requests)
  })

  it('removes every document listener it added', async () => {
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    await opened()
    host?.close()
    await settle()
    const typesOf = (spy: typeof added): unknown[] => spy.mock.calls.map(([type]) => type).sort()
    expect(typesOf(added)).not.toEqual([])
    expect(typesOf(removed)).toEqual(typesOf(added))
  })

  it('can be opened again afterwards', async () => {
    const started = await opened()
    started.close()
    await settle()
    started.open()
    await settle()
    expect(isOpen()).toBe(true)
    expect(pageIsMarkedOpen()).toBe(true)
  })
})

describe('history', () => {
  it('opens when the user comes back to the #highlights entry', async () => {
    const started = await opened()
    started.close()
    await settle()
    window.history.forward()
    await settle()
    expect(isOpen()).toBe(false)
    window.history.replaceState(null, '', LIBRARY_ADDRESS)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()
    expect(isOpen()).toBe(true)
  })
})

describe('Back into the view from another page', () => {
  const comeBackFrom = async (from: { path: string; id: string | null }): Promise<void> => {
    await opened()
    window.history.pushState(null, '', from.path)
    store.conversationId.value = from.id
    expect(isOpen()).toBe(false)
    window.history.replaceState(null, '', LIBRARY_ADDRESS)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()
  }

  it.each([
    { name: 'another chat', path: `/c/${OTHER_CONVERSATION_ID}`, id: OTHER_CONVERSATION_ID },
    { name: 'the home page', path: '/', id: null },
  ])('reopens on Back from $name and stays open once the page follows', async (from) => {
    await comeBackFrom(from)
    expect(isOpen()).toBe(true)
    expect(store.libraryOver.value).toBeNull()
    store.conversationId.value = null
    expect(isOpen()).toBe(true)
    window.history.pushState(null, '', `/c/${OTHER_CONVERSATION_ID}`)
    store.conversationId.value = OTHER_CONVERSATION_ID
    expect(isOpen()).toBe(false)
  })

  it('reopens on Back after a sidebar chat click took the user away', async () => {
    await opened()
    clickWithoutNavigating(HISTORY_LINK)
    window.history.pushState(null, '', `/c/${OTHER_CONVERSATION_ID}`)
    store.conversationId.value = OTHER_CONVERSATION_ID
    window.history.replaceState(null, '', LIBRARY_ADDRESS)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()
    store.conversationId.value = null
    expect(isOpen()).toBe(true)
  })

  it('reopens on Back to a home-page entry and stays open once the page follows', async () => {
    window.history.replaceState(null, '', '/')
    store.conversationId.value = null
    await opened()
    window.history.pushState(null, '', `/c/${OTHER_CONVERSATION_ID}`)
    store.conversationId.value = OTHER_CONVERSATION_ID
    window.history.replaceState(null, '', LIBRARY_ADDRESS)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()
    expect(isOpen()).toBe(true)
    store.conversationId.value = null
    expect(isOpen()).toBe(true)
  })
})

describe('data.changed', () => {
  it('reloads the snapshot while the view is open', async () => {
    await opened()
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await settle()
    expect(background.sent('library.snapshot')).toHaveLength(2)
    expect(store.library.value?.snapshot).toEqual(EMPTY_SNAPSHOT)
  })

  it('does nothing while the view is closed', async () => {
    begin()
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await settle()
    expect(background.sent()).toEqual([])
  })
})

describe('when the snapshot cannot be loaded', () => {
  it('shows the error and closes a view that never had content', async () => {
    background.answerWith(() => err(OFFLINE_FAILURE))
    await withRealTimers(() => {
      begin()
      hooks.settle()
      sidebarItem().click()
    })
    expect(store.toast.value?.message).toBe(LOAD_FAILED_MESSAGE)
    expect(isOpen()).toBe(false)
    expect(pageIsMarkedOpen()).toBe(false)
    expect(window.location.hash).toBe('')
  })

  it('keeps showing the last snapshot when a reload fails', async () => {
    await opened()
    background.answerWith(() => err(OFFLINE_FAILURE))
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await settle()
    expect(store.toast.value?.message).toBe(LOAD_FAILED_MESSAGE)
    expect(store.library.value?.snapshot).toEqual(SNAPSHOT)
  })

  it('keeps the newest snapshot when reload answers arrive out of order', async () => {
    const newest: Snapshot = {
      ...SNAPSHOT,
      highlights: [...SNAPSHOT.highlights, makeHighlight({ id: 'h-2' })],
    }
    await opened()
    const older = Promise.withResolvers<unknown>()
    const newer = Promise.withResolvers<unknown>()
    const gates = [older, newer]
    background.answerWith(() => gates.shift()?.promise)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    newer.resolve(ok(newest))
    await settle()
    older.resolve(ok(EMPTY_SNAPSHOT))
    await settle()
    expect(store.library.value?.snapshot).toEqual(newest)
  })

  it('drops an answer that arrives after the view was closed', async () => {
    const gate = background.hold()
    const started = begin()
    started.open()
    started.close()
    gate.resolve(ok(SNAPSHOT))
    await settle()
    expect(store.library.value).toBeNull()
  })
})

describe('stopping', () => {
  it('takes its sidebar item off the page', async () => {
    const started = await opened()
    started.stop()
    expect(destinationCount()).toBe(nativeCount)
  })

  it('lets a restarted host open from its own sidebar item', async () => {
    const started = await opened()
    started.stop()
    window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
    store = createStore()
    store.conversationId.value = FIXTURE_CONVERSATION_ID
    await opened()
    expect(isOpen()).toBe(true)
  })

  it('closes the view and stops following the page', async () => {
    const started = await opened()
    started.stop()
    expect(isOpen()).toBe(false)
    expect(pageIsMarkedOpen()).toBe(false)
    sidebarItem().remove()
    hooks.settle()
    expect(destinationCount()).toBe(nativeCount)
    await deliverMessage(LIBRARY_OPEN)
    window.history.replaceState(null, '', LIBRARY_ADDRESS)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()
    expect(isOpen()).toBe(false)
  })

  it('leaves the address alone', async () => {
    const started = await opened()
    started.stop()
    expect(window.location.hash).toBe(LIBRARY_HASH)
  })
})
