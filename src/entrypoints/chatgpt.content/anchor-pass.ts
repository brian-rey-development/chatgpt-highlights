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

const settleOrphans = (store: Store, anchored: readonly Anchored[]): void => {
  const current = store.orphanIds.value
  const missed = anchored.filter(({ range }) => !range).map(({ highlight }) => highlight.id)
  const found = anchored.filter(({ range }) => range).map(({ highlight }) => highlight.id)
  const unchanged = found.every((id) => !current.has(id)) && missed.every((id) => current.has(id))
  if (unchanged) return
  const next = new Set(current)
  for (const id of found) next.delete(id)
  for (const id of missed) next.add(id)
  store.orphanIds.value = next
}

export const anchorUnits = (
  { store, painter }: AnchorTarget,
  units: Iterable<MessageUnit>,
): void => {
  const index = indexByMessage(store.highlights.value)
  const anchored: Anchored[] = []
  for (const unit of units) {
    const highlights = index.get(unit.messageId)
    if (highlights) anchored.push(...anchorUnit(painter, unit, highlights))
  }
  settleOrphans(store, anchored)
}
