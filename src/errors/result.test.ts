import { describe, expect, expectTypeOf, it } from 'vitest'
import type { AppError } from './app-error'
import { err, ok, type Result } from './result'

const error: AppError = { code: 'not_found', message: 'gone' }

describe('Result helpers', () => {
  it('wraps data in a successful result', () => {
    expect(ok({ id: 'h1' })).toEqual({ ok: true, data: { id: 'h1' } })
  })

  it('wraps an error in a failed result', () => {
    expect(err(error)).toEqual({ ok: false, error })
  })

  it('types successes as Result<T> and failures as Result<never>', () => {
    expectTypeOf(ok(3)).toEqualTypeOf<Result<number>>()
    expectTypeOf(err(error)).toEqualTypeOf<Result<never>>()
  })
})
