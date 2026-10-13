import { describe, expect, it, vi } from 'vitest'
import { fakeSettle } from './fake-settle'

describe('fakeSettle', () => {
  it('runs every hook on each settle', () => {
    const { afterSettle, settle } = fakeSettle()
    const first = vi.fn()
    const second = vi.fn()
    afterSettle(first)
    afterSettle(second)
    settle()
    settle()
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('stops running a hook once it is disposed', () => {
    const { afterSettle, settle } = fakeSettle()
    const hook = vi.fn()
    afterSettle(hook)()
    settle()
    expect(hook).not.toHaveBeenCalled()
  })

  it('lets a hook dispose itself while the hooks run', () => {
    const { afterSettle, settle } = fakeSettle()
    const second = vi.fn()
    const stopFirst = afterSettle(() => stopFirst())
    afterSettle(second)
    settle()
    expect(second).toHaveBeenCalledOnce()
  })
})
