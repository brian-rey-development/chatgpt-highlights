import { describe, expect, it, vi } from 'vitest'
import { makeOverlayRoot } from '@/testing'
import { listen } from './listen'

const press = (target: EventTarget): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
}

describe('listen', () => {
  it.each([
    { name: 'a document', target: () => document },
    { name: 'a window', target: () => window },
    { name: 'a shadow root', target: () => makeOverlayRoot() },
  ])('hears events on $name until it is stopped', ({ target }) => {
    const heard = vi.fn()
    const place = target()
    const stop = listen(place, { type: 'keydown' }, heard)
    press(place)
    stop()
    press(place)
    expect(heard).toHaveBeenCalledOnce()
  })

  it('removes exactly the listener it added, with the same capture flag', () => {
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    listen(document, { type: 'keydown', capture: true }, vi.fn())()
    const [type, handler, options] = added.mock.calls[0] ?? []
    expect(removed).toHaveBeenCalledOnce()
    expect(removed).toHaveBeenCalledWith(type, handler, options)
    expect(options).toEqual({ capture: true })
  })

  it('stops a capture listener for good', () => {
    const heard = vi.fn()
    listen(document, { type: 'keydown', capture: true }, heard)()
    press(document.body)
    expect(heard).not.toHaveBeenCalled()
  })

  it('passes the typed event to the listener', () => {
    let key = ''
    const stop = listen(document, { type: 'keydown' }, (event) => {
      key = event.key
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    stop()
    expect(key).toBe('a')
  })
})
