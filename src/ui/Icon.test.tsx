import { render } from '@testing-library/preact'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { HIGHLIGHTER_ICON } from '@/model'
import { Icon, type IconName } from './Icon'

const NAMES: readonly IconName[] = [
  'highlighter',
  'note',
  'quote',
  'trash',
  'copy',
  'close',
  'open',
  'download',
  'upload',
  'search',
]

const svgOf = (container: Element): SVGSVGElement => {
  const svg = container.querySelector('svg')
  if (svg === null) throw new Error('no svg rendered')
  return svg
}

describe('Icon', () => {
  it.each(NAMES)('draws %s with at least one shape', (name) => {
    const svg = svgOf(render(<Icon name={name} />).container)
    expect(svg.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0)
  })

  it('draws a 20px stroke frame in the text color', () => {
    const svg = svgOf(render(<Icon name="note" />).container)
    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('fill')).toBe('none')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('stroke-width')).toBe('1.6')
  })

  it('draws a different glyph for every name', () => {
    const glyphs = NAMES.map((name) => svgOf(render(<Icon name={name} />).container).innerHTML)
    expect(new Set(glyphs).size).toBe(NAMES.length)
  })

  it('draws the highlighter from the shared glyph data', () => {
    const svg = svgOf(render(<Icon name="highlighter" />).container)
    const drawn = [...svg.querySelectorAll('path')].map((path) => path.getAttribute('d'))
    expect(drawn).toEqual(HIGHLIGHTER_ICON.paths)
    expect(svg.getAttribute('width')).toBe(String(HIGHLIGHTER_ICON.size))
  })

  it.each([
    { size: 'sm', pixels: '16' },
    { size: 'md', pixels: '18' },
    { size: 'lg', pixels: '20' },
  ] as const)('draws the $size size at $pixels pixels', ({ size, pixels }) => {
    const svg = svgOf(render(<Icon name="trash" size={size} />).container)
    expect(svg.getAttribute('width')).toBe(pixels)
    expect(svg.getAttribute('height')).toBe(pixels)
  })

  it('stays out of the accessibility tree', () => {
    const svg = svgOf(render(<Icon name="quote" />).container)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
  })

  it('rejects unknown names at compile time', () => {
    expectTypeOf<'sparkles'>().not.toExtend<IconName>()
  })
})
