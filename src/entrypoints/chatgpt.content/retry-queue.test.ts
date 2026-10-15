import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRetries,
  createRetryQueue,
  forgetRetry,
  RETRY_DELAYS_MS,
  type RetryQueue,
  recordMisses,
  scheduleRetry,
} from './retry-queue'

const [FIRST_DELAY_MS, SECOND_DELAY_MS, LAST_DELAY_MS] = RETRY_DELAYS_MS

let queue: RetryQueue
let due: Element[][]

const mountedUnit = (): Element => {
  const element = document.createElement('div')
  document.body.append(element)
  return element
}

const onDue = (elements: Element[]): void => {
  due.push(elements)
}

beforeEach(() => {
  vi.useFakeTimers()
  queue = createRetryQueue()
  due = []
})

describe('recordMisses', () => {
  it('starts a missed unit with no tries used', () => {
    const unit = mountedUnit()
    recordMisses(queue, [unit], [unit])
    expect(queue.attempts.get(unit)).toBe(0)
  })

  it('keeps the tries already used when the unit is missed again', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, 2)
    recordMisses(queue, [unit], [unit])
    expect(queue.attempts.get(unit)).toBe(2)
  })

  it('forgets a unit that was placed', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, 1)
    recordMisses(queue, [unit], [])
    expect(queue.attempts.has(unit)).toBe(false)
  })

  it('leaves alone a unit that was not part of the pass', () => {
    const other = mountedUnit()
    queue.attempts.set(other, 1)
    recordMisses(queue, [], [])
    expect(queue.attempts.get(other)).toBe(1)
  })
})

describe('scheduleRetry', () => {
  it('hands the unit back after each delay and then gives up', () => {
    const unit = mountedUnit()
    recordMisses(queue, [unit], [unit])
    for (const delay of RETRY_DELAYS_MS) {
      scheduleRetry(queue, onDue)
      vi.advanceTimersByTime(delay - 1)
      expect(due).toHaveLength(RETRY_DELAYS_MS.indexOf(delay))
      vi.advanceTimersByTime(1)
    }
    scheduleRetry(queue, onDue)
    expect(due).toEqual([[unit], [unit], [unit]])
    expect(queue.attempts.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits the delay of the unit with the fewest tries used', () => {
    const fresh = mountedUnit()
    const tired = mountedUnit()
    queue.attempts.set(tired, 2)
    queue.attempts.set(fresh, 0)
    scheduleRetry(queue, onDue)
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(due).toEqual([[tired, fresh]])
    expect(queue.attempts.get(fresh)).toBe(1)
  })

  it('uses the second and last delays for later tries', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, 1)
    scheduleRetry(queue, onDue)
    vi.advanceTimersByTime(SECOND_DELAY_MS)
    scheduleRetry(queue, onDue)
    vi.advanceTimersByTime(LAST_DELAY_MS)
    expect(due).toEqual([[unit], [unit]])
  })

  it('keeps a single timer however often it is asked', () => {
    queue.attempts.set(mountedUnit(), 0)
    scheduleRetry(queue, onDue)
    scheduleRetry(queue, onDue)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('sets no timer when nothing is waiting', () => {
    scheduleRetry(queue, onDue)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('drops a unit that used all its tries without setting a timer for it', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, RETRY_DELAYS_MS.length)
    scheduleRetry(queue, onDue)
    expect(queue.attempts.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('drops a unit that left the page before its turn', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, 0)
    scheduleRetry(queue, onDue)
    unit.remove()
    vi.advanceTimersByTime(FIRST_DELAY_MS)
    expect(due).toEqual([[]])
    expect(queue.attempts.size).toBe(0)
  })
})

describe('forgetRetry', () => {
  it('removes the unit so it gets a fresh set of tries', () => {
    const unit = mountedUnit()
    queue.attempts.set(unit, 2)
    forgetRetry(queue, unit)
    expect(queue.attempts.has(unit)).toBe(false)
  })
})

describe('clearRetries', () => {
  it('forgets every unit and cancels the timer', () => {
    queue.attempts.set(mountedUnit(), 0)
    scheduleRetry(queue, onDue)
    clearRetries(queue)
    expect(queue.attempts.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(queue.timer).toBeNull()
  })

  it('is harmless when nothing is scheduled', () => {
    clearRetries(queue)
    expect(queue.timer).toBeNull()
  })
})
