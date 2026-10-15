import { describe, expect, it } from 'vitest'
import { AppFailure, type ErrorCode, messageOf, toAppError, userMessageOf } from './app-error'

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

const ERROR_CODES: readonly ErrorCode[] = [
  'invalid_message',
  'invalid_backup',
  'not_found',
  'unreachable',
  'unexpected',
]
const RAW_TEXT = 'b3f1c2d4-1111-2222-3333-444455556666 failed in IDBObjectStore.put'

describe('userMessageOf', () => {
  it.each(ERROR_CODES.map((code) => ({ code })))(
    'never shows the raw text of a $code error',
    ({ code }) => {
      const message = userMessageOf({ code, message: RAW_TEXT })
      expect(message).not.toContain(RAW_TEXT)
      expect(message).not.toBe('')
    },
  )

  it('gives every error code its own sentence', () => {
    const messages = ERROR_CODES.map((code) => userMessageOf({ code, message: RAW_TEXT }))
    expect(new Set(messages).size).toBe(ERROR_CODES.length)
  })
})
