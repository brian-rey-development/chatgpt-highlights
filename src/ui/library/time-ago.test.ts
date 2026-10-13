import { describe, expect, it } from 'vitest'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/model'
import { FIXED_TIME } from '@/testing'
import { timeAgo } from './time-ago'

const NOW = FIXED_TIME

describe('timeAgo', () => {
  it.each([
    { name: 'seconds ago', elapsed: 30_000, expected: 'Just now' },
    { name: 'a clock running behind', elapsed: -5 * MINUTE_MS, expected: 'Just now' },
    { name: 'minutes ago', elapsed: 5 * MINUTE_MS, expected: '5 minutes ago' },
    { name: 'one hour ago', elapsed: HOUR_MS, expected: '1 hour ago' },
    { name: 'hours ago', elapsed: 5 * HOUR_MS, expected: '5 hours ago' },
    { name: 'yesterday', elapsed: DAY_MS, expected: 'Yesterday' },
    { name: 'days ago', elapsed: 3 * DAY_MS, expected: '3 days ago' },
    { name: 'last week', elapsed: 7 * DAY_MS, expected: 'Last week' },
    { name: 'weeks ago', elapsed: 15 * DAY_MS, expected: '2 weeks ago' },
    { name: 'last month', elapsed: 31 * DAY_MS, expected: 'Last month' },
    { name: 'months ago', elapsed: 100 * DAY_MS, expected: '3 months ago' },
    { name: 'last year', elapsed: 366 * DAY_MS, expected: 'Last year' },
  ])('says $expected for $name', ({ elapsed, expected }) => {
    expect(timeAgo(NOW - elapsed, NOW)).toBe(expected)
  })
})
