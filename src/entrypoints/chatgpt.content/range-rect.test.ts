import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeRangeBox, rangeOver } from '@/testing'
import { firstLineRect, lineRectAt } from './range-rect'

const FIRST_LINE = new DOMRect(10, 100, 200, 20)
const SECOND_LINE = new DOMRect(10, 120, 80, 20)
const WHOLE = new DOMRect(10, 100, 200, 40)
const BELOW_BOTH_LINES = 300

const lines = (): Range => {
  const range = rangeOver(document.body)
  range.getBoundingClientRect = () => WHOLE
  return range
}

describe('firstLineRect', () => {
  it('is the first line of a range that spans several', () => {
    installFakeRangeBox(FIRST_LINE, SECOND_LINE)
    expect(firstLineRect(lines())).toBe(FIRST_LINE)
  })

  it('falls back to the bounding box when the range has no line boxes', () => {
    installFakeRangeBox()
    expect(firstLineRect(lines())).toBe(WHOLE)
  })
})

describe('lineRectAt', () => {
  beforeEach(() => installFakeRangeBox(FIRST_LINE, SECOND_LINE))

  it('is the line under the given height', () => {
    expect(lineRectAt(lines(), 130)).toBe(SECOND_LINE)
    expect(lineRectAt(lines(), 105)).toBe(FIRST_LINE)
  })

  it('falls back to the bounding box when no line is under the height', () => {
    expect(lineRectAt(lines(), BELOW_BOTH_LINES)).toBe(WHOLE)
  })
})
