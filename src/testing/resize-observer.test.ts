import { describe, expect, it, vi } from 'vitest'
import { installFakeResizeObserver } from './resize-observer'

describe('installFakeResizeObserver', () => {
  it('reports observed targets and calls back on resize', () => {
    const observers = installFakeResizeObserver()
    const callback = vi.fn()
    const target = document.createElement('main')
    const observer = new ResizeObserver(callback)
    observer.observe(target)
    expect(observers.observed()).toEqual([target])
    observers.resize()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('forgets an observer once it disconnects', () => {
    const observers = installFakeResizeObserver()
    const callback = vi.fn()
    const observer = new ResizeObserver(callback)
    observer.observe(document.body)
    observer.disconnect()
    observers.resize()
    expect(observers.observed()).toEqual([])
    expect(callback).not.toHaveBeenCalled()
  })

  it('stops reporting a target it no longer observes', () => {
    const observers = installFakeResizeObserver()
    const kept = document.createElement('main')
    const dropped = document.createElement('nav')
    const observer = new ResizeObserver(vi.fn())
    observer.observe(kept)
    observer.observe(dropped)
    observer.unobserve(dropped)
    expect(observers.observed()).toEqual([kept])
  })
})
