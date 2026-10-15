import { locateQuote, type MessageText, rangeOfSpan, readMessageText } from '@/anchoring'
import { IGNORED_TEXT_SELECTOR, type MessageUnit } from '@/chatgpt'
import type { Highlight, Quote } from '@/model'
import { type Painter, paint, unpaint } from '@/painter'
import type { Runtime, Store } from './store'

type AnchorTarget = Pick<Runtime, 'store' | 'painter'>

interface Anchored {
  highlight: Highlight
  range: Range | null
}

const messageIndexes = new WeakMap<
  ReadonlyMap<string, Highlight>,
  ReadonlyMap<string, Highlight[]>
>()

const indexByMessage = (
  highlights: ReadonlyMap<string, Highlight>,
): ReadonlyMap<string, Highlight[]> => {
  const cached = messageIndexes.get(highlights)
  if (cached) return cached
  const index = Map.groupBy(highlights.values(), (highlight) => highlight.messageId)
  messageIndexes.set(highlights, index)
  return index
}

const rangeOfQuote = (message: MessageText, quote: Quote): Range | null => {
  const span = locateQuote(message.text, quote)
  return span ? rangeOfSpan(message, span) : null
}

const place = (painter: Painter, { highlight, range }: Anchored): void => {
  if (!range) {
    unpaint(painter, highlight.id)
    return
  }
  const { id, color, note } = highlight
  paint(painter, { id, range, color, hasNote: note !== '' })
}

const anchorUnit = (
  painter: Painter,
  unit: MessageUnit,
  highlights: readonly Highlight[],
): Anchored[] => {
  const message = readMessageText(unit.textRoot, IGNORED_TEXT_SELECTOR)
  const anchored = highlights.map((highlight) => ({
    highlight,
    range: rangeOfQuote(message, highlight.quote),
  }))
  for (const anchoredHighlight of anchored) place(painter, anchoredHighlight)
  return anchored
}

const idsWhere = (anchored: readonly Anchored[], isPlaced: boolean): string[] =>
  anchored.filter(({ range }) => (range !== null) === isPlaced).map(({ highlight }) => highlight.id)

const settleOrphans = (store: Store, anchored: readonly Anchored[]): void => {
  const current = store.orphanIds.value
  const found = new Set(idsWhere(anchored, true))
  const missed = idsWhere(anchored, false).filter((id) => !found.has(id))
  const isUnchanged =
    [...found].every((id) => !current.has(id)) && missed.every((id) => current.has(id))
  if (isUnchanged) return
  store.orphanIds.value = new Set([...current].filter((id) => !found.has(id)).concat(missed))
}

export const anchorUnits = (
  { store, painter }: AnchorTarget,
  units: Iterable<MessageUnit>,
): Element[] => {
  const index = indexByMessage(store.highlights.value)
  const anchored: Anchored[] = []
  const missed: Element[] = []
  for (const unit of units) {
    const highlights = index.get(unit.messageId)
    if (!highlights) continue
    const placed = anchorUnit(painter, unit, highlights)
    anchored.push(...placed)
    if (placed.some(({ range }) => !range)) missed.push(unit.element)
  }
  settleOrphans(store, anchored)
  return missed
}

export const orphanUnplaced = (
  { store, painter }: AnchorTarget,
  lostIds: readonly string[],
): void => {
  const current = store.orphanIds.value
  const orphaned = lostIds.filter(
    (id) => store.highlights.value.has(id) && !painter.painted.has(id) && !current.has(id),
  )
  if (orphaned.length === 0) return
  store.orphanIds.value = new Set([...current, ...orphaned])
}
