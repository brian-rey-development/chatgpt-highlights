import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cloneElement,
  defineOnPrototype,
  documentWithLocation,
  ESCAPE_INIT,
  FRAME_MS,
  makeOverlayRoot,
  nextFrame,
  rangeOver,
  requireElement,
  requireText,
  restorePrototypes,
  selectRange,
  settle,
  stubElementBox,
  typeInOverlay,
} from './dom'
import { mountFixture } from './fixtures'

beforeEach(() =>
  mountFixture('<section><p id="first">one <b>two</b></p></section><p id="second">x</p>'),
)

describe('requireElement', () => {
  it('returns the first match in the document', () => {
    expect(requireElement('p').id).toBe('first')
  })

  it('searches only below the given root', () => {
    expect(requireElement('p', requireElement('section')).id).toBe('first')
    expect(() => requireElement('#second', requireElement('section'))).toThrow(
      'fixture has no #second',
    )
  })

  it('names the selector when nothing matches', () => {
    expect(() => requireElement('.missing')).toThrow('fixture has no .missing')
  })
})

describe('requireText', () => {
  it('returns the first child when it is a text node', () => {
    expect(requireText(requireElement('#first')).data).toBe('one ')
  })

  it('throws when the first child is not text', () => {
    expect(() => requireText(requireElement('section'))).toThrow('fixture element has no text')
  })
})

describe('rangeOver', () => {
  it('selects all contents of a node', () => {
    const range = rangeOver(requireElement('#first'))
    expect(range.toString()).toBe('one two')
    expect(range.commonAncestorContainer).toBe(requireElement('#first'))
  })
})

describe('documentWithLocation', () => {
  it('answers for location and for nothing else', () => {
    const assign = vi.fn()
    const stand = documentWithLocation(document, { assign })
    stand.location.assign('https://chatgpt.com/c/x')
    expect(assign).toHaveBeenCalledWith('https://chatgpt.com/c/x')
    expect(stand.querySelector('#first')).toBe(requireElement('#first'))
    expect(stand.body).toBe(document.body)
  })
})

describe('selectRange', () => {
  it('replaces the document selection with the range', () => {
    selectRange(rangeOver(requireElement('#first')))
    selectRange(rangeOver(requireElement('#second')))
    expect(document.getSelection()?.toString()).toBe('x')
    expect(document.getSelection()?.rangeCount).toBe(1)
  })
})

describe('stubElementBox', () => {
  it('gives every element the same bounding box', () => {
    const box = new DOMRect(1, 2, 30, 40)
    stubElementBox(box)
    expect(requireElement('#first').getBoundingClientRect()).toBe(box)
    expect(requireElement('b').getBoundingClientRect()).toBe(box)
  })
})

describe('cloneElement', () => {
  it('copies the element with its subtree, detached from the document', () => {
    const copy = cloneElement(requireElement('#first'))
    expect(copy).not.toBe(requireElement('#first'))
    expect(copy.outerHTML).toBe(requireElement('#first').outerHTML)
    expect(copy.isConnected).toBe(false)
  })
})

describe('nextFrame', () => {
  beforeEach(() => vi.useFakeTimers())

  it('runs the timers due within one frame and no later ones', async () => {
    const due = vi.fn()
    const later = vi.fn()
    setTimeout(due, FRAME_MS)
    setTimeout(later, FRAME_MS + 1)
    await nextFrame()
    expect(due).toHaveBeenCalledOnce()
    expect(later).not.toHaveBeenCalled()
  })
})

describe('settle', () => {
  beforeEach(() => vi.useFakeTimers())

  it('runs the timers due now and nothing later', async () => {
    const due = vi.fn()
    const later = vi.fn()
    setTimeout(due, 0)
    setTimeout(later, 1)
    await settle()
    expect(due).toHaveBeenCalledOnce()
    expect(later).not.toHaveBeenCalled()
  })
})

describe('defineOnPrototype and restorePrototypes', () => {
  it('restores the original member after restorePrototypes', () => {
    const original = Element.prototype.getAttribute
    defineOnPrototype(Element.prototype, { getAttribute: () => 'replaced' })
    expect(requireElement('p').getAttribute('id')).toBe('replaced')
    restorePrototypes()
    expect(Element.prototype.getAttribute).toBe(original)
    expect(requireElement('p').getAttribute('id')).toBe('first')
  })

  it('removes a member that did not exist before', () => {
    defineOnPrototype(document, { caretPositionFromPoint: () => null })
    expect('caretPositionFromPoint' in document).toBe(true)
    restorePrototypes()
    expect('caretPositionFromPoint' in document).toBe(false)
  })

  it('restores a member replaced twice to the very first one', () => {
    const original = Element.prototype.getAttribute
    defineOnPrototype(Element.prototype, { getAttribute: () => 'one' })
    defineOnPrototype(Element.prototype, { getAttribute: () => 'two' })
    restorePrototypes()
    expect(Element.prototype.getAttribute).toBe(original)
  })
})

describe('the overlay stand-in', () => {
  it('hears keys typed inside it on its own root and keeps them from the page', () => {
    const root = makeOverlayRoot()
    const onRoot = vi.fn()
    const onPage = vi.fn()
    root.addEventListener('keydown', onRoot)
    document.addEventListener('keydown', onPage)
    typeInOverlay(root, 'Escape')
    document.removeEventListener('keydown', onPage)
    expect(onRoot).toHaveBeenCalledOnce()
    expect(onRoot.mock.calls[0]?.[0]).toMatchObject({ key: 'Escape' })
    expect(onPage).not.toHaveBeenCalled()
  })

  it('builds Escape events that cross shadow boundaries', () => {
    expect(ESCAPE_INIT).toEqual({ key: 'Escape', bubbles: true, composed: true })
  })
})
