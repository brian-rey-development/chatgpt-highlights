import { describe, expect, it, vi } from 'vitest'
import { reportFailure } from './report-failure'

describe('reportFailure', () => {
  it('surfaces the error through the global error channel without throwing', () => {
    const report = vi.fn()
    vi.stubGlobal('reportError', report)
    const failure = new Error('purge failed')
    expect(() => reportFailure(failure)).not.toThrow()
    expect(report).toHaveBeenCalledWith(failure)
  })
})
