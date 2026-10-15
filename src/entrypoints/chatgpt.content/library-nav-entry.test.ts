import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NAV_ATTR, SIDEBAR_DESTINATION } from '@/chatgpt'
import {
  type FakeResizeObservers,
  installFakeResizeObserver,
  MAIN_NAV,
  mountFixture,
  nextFrame,
  RAIL_NAV,
  requireElement,
  sidebarHtml,
} from '@/testing'
import { type NavEntry, startNavEntry } from './library-nav-entry'

let observers: FakeResizeObservers
let entry: NavEntry

const entryCount = (): number => document.querySelectorAll(`[${NAV_ATTR}]`).length

const hideMainNav = (): void => {
  for (const nav of document.querySelectorAll(`${MAIN_NAV}, ${RAIL_NAV}`)) {
    nav.toggleAttribute('hidden')
  }
  for (const button of document.querySelectorAll(SIDEBAR_DESTINATION)) {
    button.removeAttribute('hidden')
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  mountFixture(sidebarHtml)
  observers = installFakeResizeObserver()
})

describe('startNavEntry', () => {
  it('puts nothing on the page until asked to keep it shown', () => {
    entry = startNavEntry(document, vi.fn())
    expect(entryCount()).toBe(0)
  })

  it('inserts the entry once and not again while it stays visible', () => {
    entry = startNavEntry(document, vi.fn())
    entry.keepShown()
    entry.keepShown()
    expect(entryCount()).toBe(1)
  })

  it('runs the click callback when the entry is clicked', () => {
    const onClick = vi.fn()
    entry = startNavEntry(document, onClick)
    entry.keepShown()
    requireElement<HTMLElement>(`[${NAV_ATTR}]`).click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('knows which targets sit inside its entry', () => {
    entry = startNavEntry(document, vi.fn())
    expect(entry.contains(document.body)).toBe(false)
    entry.keepShown()
    expect(entry.contains(requireElement(`[${NAV_ATTR}]`))).toBe(true)
    expect(entry.contains(document.body)).toBe(false)
  })

  it('moves the entry after its nav is hidden and the box changed, once per frame', async () => {
    entry = startNavEntry(document, vi.fn())
    entry.keepShown()
    hideMainNav()
    observers.resize()
    observers.resize()
    await nextFrame()
    expect(requireElement(`[${NAV_ATTR}]`).checkVisibility()).toBe(true)
    expect(entryCount()).toBe(1)
  })

  it('removes the entry and stops following on stop', async () => {
    entry = startNavEntry(document, vi.fn())
    entry.keepShown()
    hideMainNav()
    observers.resize()
    entry.stop()
    await nextFrame()
    expect(entryCount()).toBe(0)
    expect(entry.contains(document.body)).toBe(false)
  })

  it('stops cleanly when nothing was ever shown', () => {
    entry = startNavEntry(document, vi.fn())
    entry.stop()
    expect(entryCount()).toBe(0)
  })
})
