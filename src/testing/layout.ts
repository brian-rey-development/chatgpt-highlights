import { vi } from 'vitest'
import { defineOnPrototype } from './dom'

interface CaretStub {
  offsetNode: Node
  offset: number
}

export const FIRST_LINE_BOX = new DOMRect(40, 90, 200, 20)

export const installFakeRangeBox = (...boxes: DOMRect[]): void => {
  const [first = new DOMRect()] = boxes
  defineOnPrototype(Range.prototype, {
    getClientRects: () =>
      Object.assign([...boxes], { item: (index: number) => boxes[index] ?? null }),
    getBoundingClientRect: () => first,
  })
}

export const installFakeCaret = (caret: CaretStub | null): void => {
  defineOnPrototype(document, { caretPositionFromPoint: () => caret })
}

export const installFakeScrollIntoView = () => {
  const scrollIntoView = vi.fn()
  defineOnPrototype(Element.prototype, { scrollIntoView })
  return scrollIntoView
}
