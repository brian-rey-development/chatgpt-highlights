import type { Span } from '@/model'

export interface MessageText {
  readonly text: string
  readonly nodes: readonly Text[]
  readonly starts: readonly number[]
}

interface Boundary {
  node: Text
  offset: number
}

type Side = 'start' | 'end'

const collectTextNodes = (root: Element, ignoreSelector: string): Text[] => {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node instanceof Element && node.matches(ignoreSelector)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  )
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text) nodes.push(node)
  }
  return nodes
}

export const readMessageText = (root: Element, ignoreSelector: string): MessageText => {
  const nodes = collectTextNodes(root, ignoreSelector)
  let offset = 0
  const starts = nodes.map((node) => {
    const start = offset
    offset += node.data.length
    return start
  })
  return { text: nodes.map((node) => node.data).join(''), nodes, starts }
}

const clipToRange = (node: Text, range: Range): Span | null => {
  if (!range.intersectsNode(node)) return null
  const start = node === range.startContainer ? range.startOffset : 0
  const end = node === range.endContainer ? range.endOffset : node.data.length
  return start < end ? { start, end } : null
}

const slicesOf = (message: MessageText, range: Range): Span[] =>
  message.nodes.flatMap((node, index) => {
    const clipped = clipToRange(node, range)
    const base = message.starts[index] ?? 0
    return clipped ? [{ start: base + clipped.start, end: base + clipped.end }] : []
  })

const trimSpan = (text: string, span: Span): Span | null => {
  const slice = text.slice(span.start, span.end)
  const start = span.start + slice.length - slice.trimStart().length
  const end = span.end - (slice.length - slice.trimEnd().length)
  return start < end ? { start, end } : null
}

export const spanOfRange = (message: MessageText, range: Range): Span | null => {
  const slices = slicesOf(message, range)
  const first = slices[0]
  const last = slices.at(-1)
  if (!first || !last) return null
  return trimSpan(message.text, { start: first.start, end: last.end })
}

const containsOffset = (extent: Span, offset: number, side: Side): boolean =>
  side === 'start'
    ? extent.start <= offset && offset < extent.end
    : extent.start < offset && offset <= extent.end

const boundaryAt = (message: MessageText, offset: number, side: Side): Boundary | null => {
  const index = message.starts.findLastIndex((start) =>
    side === 'start' ? start <= offset : start < offset,
  )
  const node = message.nodes[index]
  const begin = message.starts[index]
  if (!node || begin === undefined) return null
  const extent = { start: begin, end: begin + node.data.length }
  return containsOffset(extent, offset, side) ? { node, offset: offset - begin } : null
}

export const rangeOfSpan = (message: MessageText, span: Span): Range | null => {
  if (span.start >= span.end) return null
  const start = boundaryAt(message, span.start, 'start')
  const end = boundaryAt(message, span.end, 'end')
  if (!start || !end) return null
  const range = start.node.ownerDocument.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  return range
}
