import { describe, expect, it } from 'vitest'
import { fieldOf } from './fields'

describe('fieldOf', () => {
  it('reads a field of an object', () => {
    expect(fieldOf({ message: 'boom' }, 'message')).toBe('boom')
  })

  it('reads an inherited field and an index of an array', () => {
    expect(fieldOf(new Error('boom'), 'message')).toBe('boom')
    expect(fieldOf(['first'], '0')).toBe('first')
  })

  it('returns undefined for a missing field', () => {
    expect(fieldOf({}, 'message')).toBeUndefined()
  })

  it.each([
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'a string', value: 'message' },
    { name: 'a number', value: 7 },
    { name: 'a function', value: () => 'message' },
  ])('returns undefined for $name', ({ value }) => {
    expect(fieldOf(value, 'message')).toBeUndefined()
  })
})
