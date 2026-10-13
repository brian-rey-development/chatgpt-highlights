import { describe, expect, it } from 'vitest'
import { requireElement } from './dom'
import { mountFixture } from './fixtures'

const ALL_PROPERTIES = { opacityProperty: true, visibilityProperty: true }

const checked = (html: string, options?: CheckVisibilityOptions): boolean => {
  mountFixture(html)
  return requireElement('#target').checkVisibility(options)
}

describe('installFakeCheckVisibility', () => {
  it.each([
    { name: 'a plain element', html: '<div><b id="target">x</b></div>', visible: true },
    { name: 'the hidden attribute', html: '<b id="target" hidden>x</b>', visible: false },
    { name: 'a hidden ancestor', html: '<nav hidden><b id="target">x</b></nav>', visible: false },
    {
      name: 'display none on an ancestor',
      html: '<div style="display: none"><b id="target">x</b></div>',
      visible: false,
    },
  ])('treats $name', ({ html, visible }) => {
    expect(checked(html)).toBe(visible)
    expect(checked(html, ALL_PROPERTIES)).toBe(visible)
  })

  it('reads visibility only when asked to', () => {
    const html = '<b id="target" style="visibility: hidden">x</b>'
    expect(checked(html)).toBe(true)
    expect(checked(html, { visibilityProperty: true })).toBe(false)
  })

  it('reads opacity of the element and its ancestors only when asked to', () => {
    const html = '<div style="opacity: 0"><b id="target">x</b></div>'
    expect(checked(html)).toBe(true)
    expect(checked(html, { opacityProperty: true })).toBe(false)
  })

  it('keeps a half transparent element visible', () => {
    expect(checked('<b id="target" style="opacity: 0.5">x</b>', ALL_PROPERTIES)).toBe(true)
  })
})
