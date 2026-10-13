export const firstLineRect = (range: Range): DOMRect =>
  range.getClientRects().item(0) ?? range.getBoundingClientRect()

export const lineRectAt = (range: Range, clientY: number): DOMRect =>
  Array.from(range.getClientRects()).find(
    (rect) => rect.top <= clientY && clientY <= rect.bottom,
  ) ?? range.getBoundingClientRect()
