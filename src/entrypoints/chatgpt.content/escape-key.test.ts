import { describe, expect, it, vi } from 'vitest'
import { ESCAPE_INIT, makeOverlayRoot, typeInOverlay } from '@/testing'
import { onEscape } from './escape-key'

describe('onEscape', () => {
  it('hears Escape typed on the page', () => {
    const handler = vi.fn()
    const stop = onEscape([document, makeOverlayRoot()], handler)
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    stop()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('hears Escape typed in an overlay that isolates key events from the page', () => {
    const handler = vi.fn()
    const root = makeOverlayRoot()
    const stop = onEscape([document, root], handler)
    typeInOverlay(root, 'Escape')
    stop()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('misses the overlay when only the page is listened to', () => {
    const handler = vi.fn()
    const root = makeOverlayRoot()
    const stop = onEscape([document], handler)
    typeInOverlay(root, 'Escape')
    stop()
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores every other key', () => {
    const handler = vi.fn()
    const root = makeOverlayRoot()
    const stop = onEscape([document, root], handler)
    typeInOverlay(root, 'a')
    stop()
    expect(handler).not.toHaveBeenCalled()
  })

  it('yields to an inner handler that stops the key before it bubbles', () => {
    const handler = vi.fn()
    const root = makeOverlayRoot()
    const stop = onEscape([document, root], handler)
    const menu = document.createElement('div')
    menu.addEventListener('keydown', (event) => event.stopPropagation())
    root.append(menu)
    menu.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    stop()
    expect(handler).not.toHaveBeenCalled()
  })

  it('stops listening once disposed', () => {
    const handler = vi.fn()
    const root = makeOverlayRoot()
    onEscape([document, root], handler)()
    typeInOverlay(root, 'Escape')
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    expect(handler).not.toHaveBeenCalled()
  })
})
