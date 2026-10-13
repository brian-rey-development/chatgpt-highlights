import { render } from '@testing-library/preact'
import { h } from 'preact'
import { describe, expect, it, vi } from 'vitest'
import { makeHighlight, stubElementBox } from '@/testing'
import {
  clampToViewport,
  type Point,
  placePill,
  placePopover,
  type Size,
  usePlacement,
  VIEWPORT_MARGIN_PX,
} from './placement'

const VIEWPORT = { width: 1000, height: 800 }
const PILL = { width: 160, height: 28 }
const POPOVER = { width: 320, height: 200 }

describe('clampToViewport', () => {
  it('keeps a point that already fits', () => {
    expect(clampToViewport({ left: 100, top: 100 }, PILL, VIEWPORT)).toEqual({
      left: 100,
      top: 100,
    })
  })

  it.each([
    { name: 'left', point: { left: -50, top: 100 }, expected: { left: 8, top: 100 } },
    { name: 'top', point: { left: 100, top: 2 }, expected: { left: 100, top: 8 } },
    { name: 'right', point: { left: 990, top: 100 }, expected: { left: 832, top: 100 } },
    { name: 'bottom', point: { left: 100, top: 790 }, expected: { left: 100, top: 764 } },
  ])('pulls a point off the $name edge back inside the margin', ({ point, expected }) => {
    expect(clampToViewport(point, PILL, VIEWPORT)).toEqual(expected)
  })

  it('pins an element larger than the viewport to the margin', () => {
    const huge = { width: 2000, height: 2000 }
    expect(clampToViewport({ left: 300, top: 300 }, huge, VIEWPORT)).toEqual({
      left: VIEWPORT_MARGIN_PX,
      top: VIEWPORT_MARGIN_PX,
    })
  })
})

describe('placePill', () => {
  const anchor = new DOMRect(300, 400, 120, 24)

  it('sits 6px above the first line of the selection', () => {
    expect(placePill({ anchor, dock: null }, PILL, VIEWPORT)).toEqual({ left: 300, top: 366 })
  })

  it('docks 4px to the right of the native box, level with it', () => {
    const dock = new DOMRect(200, 350, 110, 32)
    expect(placePill({ anchor, dock }, PILL, VIEWPORT)).toEqual({ left: 314, top: 350 })
  })

  it('stays 8px inside the viewport when the selection starts at the top', () => {
    const topAnchor = new DOMRect(300, 10, 120, 24)
    expect(placePill({ anchor: topAnchor, dock: null }, PILL, VIEWPORT).top).toBe(8)
  })

  it('docks 4px to the left of the native box when the right side has no room', () => {
    const dock = new DOMRect(850, 350, 140, 32)
    expect(placePill({ anchor, dock }, PILL, VIEWPORT)).toEqual({ left: 686, top: 350 })
  })

  it('docks 4px below the native box when neither side has room', () => {
    const dock = new DOMRect(100, 350, 800, 32)
    expect(placePill({ anchor, dock }, PILL, VIEWPORT)).toEqual({ left: 100, top: 386 })
  })

  it('stays 8px inside the viewport when no side of the native box has room', () => {
    const dock = new DOMRect(100, 760, 800, 32)
    expect(placePill({ anchor, dock }, PILL, VIEWPORT)).toEqual({ left: 832, top: 760 })
  })
})

describe('placePopover', () => {
  const highlight = makeHighlight()

  it('opens 8px below the highlight', () => {
    const anchor = new DOMRect(300, 100, 120, 24)
    expect(placePopover({ highlight, anchor }, POPOVER, VIEWPORT)).toEqual({ left: 300, top: 132 })
  })

  it('flips above the highlight when there is no room below', () => {
    const anchor = new DOMRect(300, 700, 120, 24)
    expect(placePopover({ highlight, anchor }, POPOVER, VIEWPORT)).toEqual({ left: 300, top: 492 })
  })

  it('stays inside the viewport horizontally', () => {
    const anchor = new DOMRect(900, 100, 120, 24)
    expect(placePopover({ highlight, anchor }, POPOVER, VIEWPORT).left).toBe(672)
  })
})

describe('usePlacement', () => {
  const BOX = { width: 120, height: 40 }
  const stubBox = (size: Size) => stubElementBox(new DOMRect(0, 0, size.width, size.height))
  type Placer = (model: null, size: Size, viewport: Size) => Point

  const Probe = ({ place }: { place: Placer }) => {
    const { ref, style } = usePlacement<HTMLDivElement, null>(null, place)
    return h('div', { ref, style, 'data-testid': 'probe' })
  }

  const Detached = ({ place }: { place: Placer }) => {
    const { style } = usePlacement<HTMLDivElement, null>(null, place)
    return h('div', { style, 'data-testid': 'detached' })
  }

  it('hands the measured size and the viewport to the placer', () => {
    stubBox(BOX)
    vi.stubGlobal('innerWidth', 900)
    vi.stubGlobal('innerHeight', 700)
    const place = vi.fn(() => ({ left: 10, top: 20 }))
    render(h(Probe, { place }))
    expect(place).toHaveBeenCalledWith(null, BOX, { width: 900, height: 700 })
  })

  it('positions the element where the placer says', () => {
    stubBox(BOX)
    const { getByTestId } = render(h(Probe, { place: () => ({ left: 10, top: 20 }) }))
    expect(getByTestId('probe')).toHaveStyle({ left: '10px', top: '20px' })
  })

  it('stays at the origin and skips the placer while the ref is unattached', () => {
    const place = vi.fn(() => ({ left: 10, top: 20 }))
    const { getByTestId } = render(h(Detached, { place }))
    expect(getByTestId('detached')).toHaveStyle({ left: '0px', top: '0px' })
    expect(place).not.toHaveBeenCalled()
  })
})
