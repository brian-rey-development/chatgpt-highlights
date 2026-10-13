import { describe, expect, it } from 'vitest'
import { mountFixture, requireElement } from '@/testing'
import { isVisible } from './visibility'

const visibilityOf = (html: string): boolean => {
  mountFixture(html)
  return isVisible(requireElement('#target'))
}

describe('isVisible', () => {
  it.each([
    { name: 'a plain element', html: '<div><b id="target">x</b></div>', expected: true },
    { name: 'the hidden attribute', html: '<b id="target" hidden>x</b>', expected: false },
    { name: 'a hidden ancestor', html: '<nav hidden><b id="target">x</b></nav>', expected: false },
    {
      name: 'display none on an ancestor',
      html: '<div style="display: none"><b id="target">x</b></div>',
      expected: false,
    },
    {
      name: 'visibility hidden on itself',
      html: '<b id="target" style="visibility: hidden">x</b>',
      expected: false,
    },
    {
      name: 'opacity zero on an ancestor',
      html: '<div style="opacity: 0"><b id="target">x</b></div>',
      expected: false,
    },
  ])('treats $name', ({ html, expected }) => {
    expect(visibilityOf(html)).toBe(expected)
  })
})
