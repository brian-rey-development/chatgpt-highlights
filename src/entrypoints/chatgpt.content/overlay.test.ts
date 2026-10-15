import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESCAPE_INIT, mountFixture } from '@/testing'
import { isOverlayEvent, mountOverlay, OVERLAY_CLASS, UI_NAME } from './overlay'

const STYLES = ':root{--hl-ink:#111}.hl-pill{color:var(--hl-ink)}'

const clickOn = (target: EventTarget): MouseEvent => {
  const event = new MouseEvent('click', { bubbles: true })
  target.dispatchEvent(event)
  return event
}

describe('isOverlayEvent', () => {
  it('recognizes an event retargeted to the overlay host', () => {
    const host = document.createElement(UI_NAME)
    expect(isOverlayEvent(clickOn(host))).toBe(true)
  })

  it('rejects an event on any other element', () => {
    expect(isOverlayEvent(clickOn(document.createElement('main')))).toBe(false)
  })

  it('rejects an event whose target is not an element', () => {
    expect(isOverlayEvent(clickOn(document))).toBe(false)
  })
})

describe('mountOverlay', () => {
  beforeEach(() => {
    mountFixture('')
  })

  it('attaches a closed root holding the stylesheet with :root rewritten to :host', () => {
    const overlay = mountOverlay(document, 'closed', STYLES)
    const css = overlay.shadowRoot.querySelector('style')?.textContent
    expect(document.querySelector(UI_NAME)?.shadowRoot).toBeNull()
    expect(css).toContain(':host{all:initial !important}')
    expect(css).toContain(':host{--hl-ink:#111}.hl-pill{color:var(--hl-ink)}')
    expect(css).not.toContain(':root')
  })

  it('opens the root to the page when asked to', () => {
    mountOverlay(document, 'open', STYLES)
    expect(document.querySelector(UI_NAME)?.shadowRoot).not.toBeNull()
  })

  it('hands out the container its app renders into, inside the root', () => {
    const overlay = mountOverlay(document, 'closed', STYLES)
    expect(overlay.container.getRootNode()).toBe(overlay.shadowRoot)
    expect(overlay.container.className).toBe(OVERLAY_CLASS)
    expect(document.body.lastElementChild?.localName).toBe(UI_NAME)
  })

  it('keeps key events typed inside away from the page', () => {
    const overlay = mountOverlay(document, 'closed', STYLES)
    const input = document.createElement('input')
    overlay.container.append(input)
    const heard = vi.fn()
    document.addEventListener('keydown', heard)
    input.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    document.removeEventListener('keydown', heard)
    expect(heard).not.toHaveBeenCalled()
  })

  it('lets pointer events through to the page', () => {
    const overlay = mountOverlay(document, 'closed', STYLES)
    const heard = vi.fn()
    document.addEventListener('pointerdown', heard)
    overlay.container.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    )
    document.removeEventListener('pointerdown', heard)
    expect(heard).toHaveBeenCalledOnce()
  })

  it('removes the host', () => {
    const overlay = mountOverlay(document, 'closed', STYLES)
    overlay.remove()
    expect(document.querySelector(UI_NAME)).toBeNull()
  })

  it('reuses the host it already mounted instead of adding a second one', () => {
    const first = mountOverlay(document, 'closed', STYLES)
    const second = mountOverlay(document, 'closed', STYLES)
    expect(second).toBe(first)
    expect(document.querySelectorAll(UI_NAME)).toHaveLength(1)
  })

  it('mounts a fresh host once the previous one is gone', () => {
    const first = mountOverlay(document, 'closed', STYLES)
    first.remove()
    const second = mountOverlay(document, 'closed', STYLES)
    expect(second).not.toBe(first)
    expect(document.querySelectorAll(UI_NAME)).toHaveLength(1)
  })

  it('mounts a fresh host when the page dropped the old one', () => {
    const first = mountOverlay(document, 'closed', STYLES)
    mountFixture('')
    const second = mountOverlay(document, 'closed', STYLES)
    expect(second).not.toBe(first)
    expect(document.querySelectorAll(UI_NAME)).toHaveLength(1)
  })
})
