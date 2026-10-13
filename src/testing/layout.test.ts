import { describe, expect, it } from 'vitest'
import { rangeOver, requireElement, requireText } from './dom'
import { mountFixture } from './fixtures'
import { installFakeCaret, installFakeRangeBox, installFakeScrollIntoView } from './layout'

const FIRST_BOX = new DOMRect(10, 20, 100, 16)
const SECOND_BOX = new DOMRect(10, 36, 60, 16)

describe('installFakeRangeBox', () => {
  it('answers every box as a client rect and the first as the bounding box', () => {
    installFakeRangeBox(FIRST_BOX, SECOND_BOX)
    const range = rangeOver(document.body)
    expect([...range.getClientRects()]).toEqual([FIRST_BOX, SECOND_BOX])
    expect(range.getClientRects().item(1)).toBe(SECOND_BOX)
    expect(range.getClientRects().item(2)).toBeNull()
    expect(range.getBoundingClientRect()).toBe(FIRST_BOX)
  })

  it('answers an empty box when none is given', () => {
    installFakeRangeBox()
    expect(rangeOver(document.body).getBoundingClientRect()).toEqual(new DOMRect())
  })
})

describe('installFakeCaret', () => {
  it('answers the given caret position wherever it is asked', () => {
    mountFixture('<p>caret</p>')
    const offsetNode = requireText(requireElement('p'))
    installFakeCaret({ offsetNode, offset: 2 })
    expect(document.caretPositionFromPoint(1, 2)).toEqual({ offsetNode, offset: 2 })
    installFakeCaret(null)
    expect(document.caretPositionFromPoint(1, 2)).toBeNull()
  })
})

describe('installFakeScrollIntoView', () => {
  it('records the elements that were scrolled to', () => {
    mountFixture('<p>scroll</p>')
    const scrollIntoView = installFakeScrollIntoView()
    const paragraph = requireElement('p')
    paragraph.scrollIntoView({ block: 'center' })
    expect(scrollIntoView.mock.contexts).toEqual([paragraph])
  })
})
