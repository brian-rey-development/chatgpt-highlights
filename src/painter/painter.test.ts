import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppFailure } from '@/errors'
import { HIGHLIGHT_COLORS } from '@/model'
import {
  installFakeCaret,
  installFakeHighlightApi,
  mountFixture,
  rangeOver,
  requireElement,
  requireText,
} from '@/testing'
import { FLASH_LAYER } from './highlight-styles'
import {
  createPainter,
  dispose,
  FLASH_MS,
  flash,
  hitTest,
  overlapsPainted,
  type PaintTarget,
  paint,
  prune,
  unpaint,
  unpaintAll,
} from './painter'

const ALL_LAYERS = [
  ...HIGHLIGHT_COLORS.flatMap((color) => [`hl-${color}`, `hl-${color}-note`]),
  FLASH_LAYER,
]

let registry: HighlightRegistry

const requireLayer = (name: string): Highlight => {
  const layer = registry.get(name)
  if (!layer) throw new Error(`no layer ${name}`)
  return layer
}

const targetFor = (id: string, overrides: Partial<PaintTarget> = {}): PaintTarget => ({
  id,
  range: rangeOver(requireText(requireElement(`#${id}`))),
  color: 'yellow',
  hasNote: false,
  ...overrides,
})

beforeEach(() => {
  registry = installFakeHighlightApi()
  mountFixture('<p id="a">alpha</p><p id="b">beta</p>')
})

describe('createPainter', () => {
  it('registers a plain and a note layer per color plus the flash layer', () => {
    createPainter(registry)
    expect([...registry.keys()].toSorted()).toEqual(ALL_LAYERS.toSorted())
    expect(registry.size).toBe(11)
  })

  it('gives the flash layer priority 1 and every other layer 0', () => {
    createPainter(registry)
    expect(requireLayer(FLASH_LAYER).priority).toBe(1)
    expect(requireLayer('hl-blue').priority).toBe(0)
    expect(requireLayer('hl-blue-note').priority).toBe(0)
  })

  it('defaults to the document highlight registry', () => {
    vi.stubGlobal('CSS', { highlights: registry })
    createPainter()
    expect(registry.size).toBe(11)
  })
})

describe('paint and unpaint', () => {
  it('puts the range in the layer of its color', () => {
    const painter = createPainter(registry)
    const target = targetFor('a', { color: 'green' })
    paint(painter, target)
    expect(requireLayer('hl-green').has(target.range)).toBe(true)
    expect(painter.painted.get('a')).toBe(target)
  })

  it('uses the note layer when the highlight has a note', () => {
    const painter = createPainter(registry)
    const target = targetFor('a', { color: 'pink', hasNote: true })
    paint(painter, target)
    expect(requireLayer('hl-pink-note').has(target.range)).toBe(true)
    expect(requireLayer('hl-pink').has(target.range)).toBe(false)
  })

  it('moves a highlight when it is repainted with a new color', () => {
    const painter = createPainter(registry)
    const target = targetFor('a')
    paint(painter, target)
    paint(painter, { ...target, color: 'purple' })
    expect(requireLayer('hl-yellow').has(target.range)).toBe(false)
    expect(requireLayer('hl-purple').has(target.range)).toBe(true)
    expect(painter.painted.size).toBe(1)
  })

  it('moves a highlight when its note state changes', () => {
    const painter = createPainter(registry)
    const target = targetFor('a')
    paint(painter, target)
    paint(painter, { ...target, hasNote: true })
    expect(requireLayer('hl-yellow').has(target.range)).toBe(false)
    expect(requireLayer('hl-yellow-note').has(target.range)).toBe(true)
  })

  it('removes a highlight on unpaint and ignores unknown ids', () => {
    const painter = createPainter(registry)
    const target = targetFor('a')
    paint(painter, target)
    unpaint(painter, 'a')
    unpaint(painter, 'missing')
    expect(requireLayer('hl-yellow').has(target.range)).toBe(false)
    expect(painter.painted.size).toBe(0)
  })

  it('rejects a painter it did not create', () => {
    const foreign = { painted: new Map() }
    expect(() => unpaint(foreign, 'a')).toThrow(AppFailure)
    expect(() => unpaint(foreign, 'a')).toThrow('createPainter')
  })
})

describe('unpaintAll', () => {
  it('removes every highlight from its layer and from the painted map', () => {
    const painter = createPainter(registry)
    const first = targetFor('a', { color: 'green' })
    const second = targetFor('b', { hasNote: true })
    paint(painter, first)
    paint(painter, second)
    unpaintAll(painter)
    expect(requireLayer('hl-green').has(first.range)).toBe(false)
    expect(requireLayer('hl-yellow-note').has(second.range)).toBe(false)
    expect(painter.painted.size).toBe(0)
  })

  it('does nothing for a painter without highlights', () => {
    const painter = createPainter(registry)
    unpaintAll(painter)
    expect(painter.painted.size).toBe(0)
  })
})

describe('prune', () => {
  it('drops ranges that live in a disconnected subtree and returns their ids', () => {
    const painter = createPainter(registry)
    const detached = document.createElement('p')
    detached.textContent = 'detached'
    const gone = targetFor('a', { range: rangeOver(requireText(detached)) })
    const kept = targetFor('b')
    paint(painter, gone)
    paint(painter, kept)
    expect(prune(painter)).toEqual(['a'])
    expect(requireLayer('hl-yellow').has(gone.range)).toBe(false)
    expect(requireLayer('hl-yellow').has(kept.range)).toBe(true)
    expect([...painter.painted.keys()]).toEqual(['b'])
  })

  it('drops ranges the browser collapsed when their node was removed', () => {
    const painter = createPainter(registry)
    paint(painter, targetFor('a'))
    requireElement('#a').remove()
    expect(prune(painter)).toEqual(['a'])
  })

  it('drops a range when only the node holding its start was removed', () => {
    const painter = createPainter(registry)
    const range = document.createRange()
    range.setStart(requireText(requireElement('#a')), 0)
    range.setEnd(requireText(requireElement('#b')), 2)
    paint(painter, targetFor('a', { range }))
    requireElement('#a').remove()
    expect(range.collapsed).toBe(false)
    expect(prune(painter)).toEqual(['a'])
  })

  it('returns nothing when every range is still connected', () => {
    const painter = createPainter(registry)
    paint(painter, targetFor('a'))
    expect(prune(painter)).toEqual([])
  })
})

describe('hitTest', () => {
  const POINT = { x: 10, y: 10 }
  const inside = [new DOMRect(0, 0, 20, 20)]
  const elsewhere = [new DOMRect(100, 0, 20, 20)]

  const withRects = (target: PaintTarget, rects: DOMRect[]): PaintTarget => {
    target.range.getClientRects = () => Object.assign([...rects], { item: () => null })
    return target
  }

  const caretAt = (selector: string): void => {
    const node = requireText(requireElement(selector))
    installFakeCaret({ offsetNode: node, offset: 1 })
  }

  it('returns the id whose range holds the caret and whose rects hold the point', () => {
    const painter = createPainter(registry)
    paint(painter, withRects(targetFor('a'), inside))
    paint(painter, withRects(targetFor('b'), elsewhere))
    caretAt('#a')
    expect(hitTest(painter, document, POINT)).toBe('a')
  })

  it('returns the last painted id when ranges overlap', () => {
    const painter = createPainter(registry)
    paint(painter, withRects(targetFor('a', { range: rangeOver(requireElement('#a')) }), inside))
    paint(painter, withRects(targetFor('b', { range: rangeOver(document.body) }), inside))
    caretAt('#a')
    expect(hitTest(painter, document, POINT)).toBe('b')
    paint(painter, withRects(targetFor('a'), inside))
    expect(hitTest(painter, document, POINT)).toBe('a')
  })

  it('returns null when the caret snapped into a range but the point is off its rects', () => {
    const painter = createPainter(registry)
    paint(painter, withRects(targetFor('a'), elsewhere))
    caretAt('#a')
    expect(hitTest(painter, document, POINT)).toBeNull()
  })

  it('returns null when the caret is outside every range', () => {
    const painter = createPainter(registry)
    paint(painter, withRects(targetFor('a'), inside))
    caretAt('#b')
    expect(hitTest(painter, document, POINT)).toBeNull()
  })

  it('returns null when the page has no caret at the point', () => {
    const painter = createPainter(registry)
    paint(painter, withRects(targetFor('a'), inside))
    installFakeCaret(null)
    expect(hitTest(painter, document, POINT)).toBeNull()
  })
})

describe('overlapsPainted', () => {
  const rangeIn = (selector: string, start: number, end: number): Range => {
    const text = requireText(requireElement(selector))
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, end)
    return range
  }

  it.each([
    { name: 'inside a highlight', start: 1, end: 3, expected: true },
    { name: 'across its start', start: 0, end: 2, expected: true },
    { name: 'across its end', start: 3, end: 5, expected: true },
    { name: 'around it', start: 0, end: 5, expected: true },
    { name: 'touching its start', start: 0, end: 1, expected: false },
    { name: 'touching its end', start: 4, end: 5, expected: false },
  ])('is $expected for a range $name', ({ start, end, expected }) => {
    const painter = createPainter(registry)
    paint(painter, targetFor('a', { range: rangeIn('#a', 1, 4) }))
    expect(overlapsPainted(painter, rangeIn('#a', start, end))).toBe(expected)
  })

  it('is false for a range in another element and for a painter without highlights', () => {
    const painter = createPainter(registry)
    expect(overlapsPainted(painter, rangeIn('#a', 0, 5))).toBe(false)
    paint(painter, targetFor('b'))
    expect(overlapsPainted(painter, rangeIn('#a', 0, 5))).toBe(false)
  })
})

describe('flash', () => {
  beforeEach(() => vi.useFakeTimers())

  it('adds the range to the flash layer and removes it after 1400 ms', () => {
    const painter = createPainter(registry)
    const target = targetFor('a')
    paint(painter, target)
    flash(painter, 'a')
    expect(requireLayer(FLASH_LAYER).has(target.range)).toBe(true)
    vi.advanceTimersByTime(FLASH_MS - 1)
    expect(requireLayer(FLASH_LAYER).has(target.range)).toBe(true)
    vi.advanceTimersByTime(1)
    expect(requireLayer(FLASH_LAYER).has(target.range)).toBe(false)
    expect(FLASH_MS).toBe(1400)
  })

  it('restarts the timer when flashed again', () => {
    const painter = createPainter(registry)
    const target = targetFor('a')
    paint(painter, target)
    flash(painter, 'a')
    vi.advanceTimersByTime(1000)
    flash(painter, 'a')
    vi.advanceTimersByTime(1000)
    expect(requireLayer(FLASH_LAYER).has(target.range)).toBe(true)
    vi.advanceTimersByTime(400)
    expect(requireLayer(FLASH_LAYER).has(target.range)).toBe(false)
  })

  it('stops a flash when the highlight is removed', () => {
    const painter = createPainter(registry)
    paint(painter, targetFor('a'))
    flash(painter, 'a')
    unpaint(painter, 'a')
    expect(requireLayer(FLASH_LAYER).size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores ids that are not painted', () => {
    const painter = createPainter(registry)
    flash(painter, 'missing')
    expect(requireLayer(FLASH_LAYER).size).toBe(0)
  })
})

describe('dispose', () => {
  it('removes every layer from the registry and forgets painted highlights', () => {
    const painter = createPainter(registry)
    paint(painter, targetFor('a'))
    dispose(painter)
    expect(registry.size).toBe(0)
    expect(painter.painted.size).toBe(0)
  })

  it('cancels a pending flash', () => {
    vi.useFakeTimers()
    const painter = createPainter(registry)
    paint(painter, targetFor('a'))
    flash(painter, 'a')
    dispose(painter)
    expect(vi.getTimerCount()).toBe(0)
  })
})
