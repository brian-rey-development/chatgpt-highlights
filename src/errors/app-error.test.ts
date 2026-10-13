import { describe, expect, it } from 'vitest'
import { AppFailure, messageOf, toAppError } from './app-error'

describe('AppFailure', () => {
  it('is an Error carrying its code and message', () => {
    const failure = new AppFailure('not_found', 'No such highlight')
    expect(failure).toBeInstanceOf(Error)
    expect(failure.code).toBe('not_found')
    expect(failure.message).toBe('No such highlight')
  })
})

describe('messageOf', () => {
  it.each([
    ['an Error', new Error('boom'), 'boom'],
    ['an AppFailure', new AppFailure('unreachable', 'offline'), 'offline'],
    ['a string', 'plain text', 'plain text'],
    ['an error-like object', { code: 'not_found', message: 'gone' }, 'gone'],
    ['an object without a message', { code: 'not_found' }, '[object Object]'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
  ])('reads the message of %s', (_label, error, expected) => {
    expect(messageOf(error)).toBe(expected)
  })
})

describe('toAppError', () => {
  it('keeps the code of an AppFailure', () => {
    expect(toAppError(new AppFailure('not_found', 'reason'))).toEqual({
      code: 'not_found',
      message: 'reason',
    })
  })

  it('maps a plain Error to unexpected with its message', () => {
    expect(toAppError(new Error('boom'))).toEqual({ code: 'unexpected', message: 'boom' })
  })

  it('maps a thrown non-error value to unexpected', () => {
    expect(toAppError('nope')).toEqual({ code: 'unexpected', message: 'nope' })
  })
})
