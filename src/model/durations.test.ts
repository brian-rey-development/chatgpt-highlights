import { describe, expect, it } from 'vitest'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './durations'

describe('durations', () => {
  it('counts milliseconds per minute, hour and day', () => {
    expect(MINUTE_MS).toBe(60_000)
    expect(HOUR_MS).toBe(3_600_000)
    expect(DAY_MS).toBe(86_400_000)
  })
})
