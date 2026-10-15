import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as anchoring from '@/anchoring'
import { describeQuote, readMessageText } from '@/anchoring'
import { IGNORED_TEXT_SELECTOR, type MessageUnit, unitOf } from '@/chatgpt'
import type { Highlight } from '@/model'
import { createPainter, type Painter } from '@/painter'
import {
  conversationHtml,
  countPaintedRanges,
  FIRST_ANSWER_ID,
  GONE_QUOTE,
  HIGH_TIDE_QUOTE,
  highlightIn,
  installFakeHighlightApi,
  LAST_ANSWER_ID,
  makeHighlight,
  mountFixture,
  PULL_QUOTE,
  requireUnit,
  SPRING_QUOTE,
} from '@/testing'
import { anchorUnits, orphanUnplaced } from './anchor-pass'
import { createStore, type Store } from './store'

const STALE_OFFSET = 3

let registry: HighlightRegistry
let painter: Painter
let store: Store

const duplicateWithoutText = (unit: MessageUnit): MessageUnit => {
  const copy = unit.element.cloneNode(true)
  unit.element.after(copy)
  const duplicate = unitOf(copy)
  if (!duplicate) throw new Error('the copy is not a message unit')
  duplicate.textRoot.textContent = GONE_QUOTE
  return duplicate
}

const load = (...highlights: Highlight[]): void => {
  store.highlights.value = new Map(highlights.map((highlight) => [highlight.id, highlight]))
}

beforeEach(() => {
  registry = installFakeHighlightApi()
  painter = createPainter(registry)
  store = createStore()
  mountFixture(conversationHtml)
})

describe('anchorUnits', () => {
  it('paints the quote in its color', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { color: 'green' })
    load(highlight)
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(painter.painted.get(highlight.id)?.range.toString()).toBe(PULL_QUOTE)
    expect(painter.painted.get(highlight.id)).toMatchObject({ color: 'green', hasNote: false })
    expect(countPaintedRanges(registry)).toBe(1)
  })

  it('marks a highlight that has a note', () => {
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { note: 'remember' }))
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(painter.painted.get(`${FIRST_ANSWER_ID}-${PULL_QUOTE}`)).toMatchObject({ hasNote: true })
  })

  it('paints the occurrence the quote context points at when the offsets are stale', () => {
    const { text } = readMessageText(requireUnit(FIRST_ANSWER_ID).textRoot, IGNORED_TEXT_SELECTOR)
    const start = text.lastIndexOf(PULL_QUOTE)
    const quote = describeQuote(text, { start, end: start + PULL_QUOTE.length })
    const stale = { ...quote, start: STALE_OFFSET, end: STALE_OFFSET + PULL_QUOTE.length }
    load(makeHighlight({ id: 'second', messageId: FIRST_ANSWER_ID, quote: stale }))
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    const range = painter.painted.get('second')?.range
    expect(range?.toString()).toBe(PULL_QUOTE)
    expect(range?.startContainer.parentElement?.closest('p')?.textContent).toMatch(
      /^The gravitational pull is strongest/,
    )
  })

  it('reads no text from a unit whose message has no highlights', () => {
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const read = vi.spyOn(anchoring, 'readMessageText')
    anchorUnits({ store, painter }, [requireUnit(LAST_ANSWER_ID)])
    expect(read).not.toHaveBeenCalled()
    expect(painter.painted.size).toBe(0)
  })

  it('reads a unit once however many highlights it holds', () => {
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE), highlightIn(FIRST_ANSWER_ID, SPRING_QUOTE))
    const read = vi.spyOn(anchoring, 'readMessageText')
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(read).toHaveBeenCalledTimes(1)
    expect(painter.painted.size).toBe(2)
  })

  it('repaints a highlight on its new range instead of adding a second one', () => {
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(countPaintedRanges(registry)).toBe(1)
  })

  it('records a quote it cannot find as an orphan and paints nothing', () => {
    const lost = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'lost' })
    load({ ...lost, quote: { ...lost.quote, exact: GONE_QUOTE } })
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect([...store.orphanIds.value]).toEqual(['lost'])
    expect(painter.painted.size).toBe(0)
  })

  it('removes the paint of a highlight that stopped matching', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    load({ ...highlight, quote: { ...highlight.quote, exact: GONE_QUOTE } })
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(painter.painted.size).toBe(0)
    expect(store.orphanIds.value.has(highlight.id)).toBe(true)
  })

  it('clears an orphan once its quote is found again', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    store.orphanIds.value = new Set([highlight.id, 'other'])
    load(highlight)
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect([...store.orphanIds.value]).toEqual(['other'])
  })

  it('keeps a highlight out of the orphans when a duplicate unit lacks its quote', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    const original = requireUnit(FIRST_ANSWER_ID)
    const duplicate = duplicateWithoutText(original)
    anchorUnits({ store, painter }, [duplicate, original])
    expect(painter.painted.has(highlight.id)).toBe(true)
    expect(store.orphanIds.value.has(highlight.id)).toBe(false)
  })

  it('leaves the orphan signal untouched when nothing changed', () => {
    const orphans = store.orphanIds.value
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    expect(store.orphanIds.value).toBe(orphans)
  })

  it('returns the units that still hold a highlight it could not place', () => {
    const lost = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'lost' })
    load(
      { ...lost, quote: { ...lost.quote, exact: GONE_QUOTE } },
      highlightIn(LAST_ANSWER_ID, HIGH_TIDE_QUOTE),
    )
    const units = [FIRST_ANSWER_ID, LAST_ANSWER_ID].map(requireUnit)
    const missed = anchorUnits({ store, painter }, units)
    expect(missed).toEqual([requireUnit(FIRST_ANSWER_ID).element])
  })

  it('returns nothing when every highlight was placed', () => {
    load(highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    expect(anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])).toEqual([])
  })

  it('does nothing for a chat without highlights', () => {
    const read = vi.spyOn(anchoring, 'readMessageText')
    anchorUnits({ store, painter }, [FIRST_ANSWER_ID, LAST_ANSWER_ID].map(requireUnit))
    expect(read).not.toHaveBeenCalled()
  })
})

describe('orphanUnplaced', () => {
  it('records highlights that are known but no longer painted', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    orphanUnplaced({ store, painter }, [highlight.id])
    expect([...store.orphanIds.value]).toEqual([highlight.id])
  })

  it('keeps the orphans it already had', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    store.orphanIds.value = new Set(['other'])
    orphanUnplaced({ store, painter }, [highlight.id])
    expect([...store.orphanIds.value]).toEqual(['other', highlight.id])
  })

  it('skips a highlight that was painted again meanwhile', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    orphanUnplaced({ store, painter }, [highlight.id])
    expect(store.orphanIds.value.size).toBe(0)
  })

  it('skips a highlight that no longer exists', () => {
    orphanUnplaced({ store, painter }, ['deleted'])
    expect(store.orphanIds.value.size).toBe(0)
  })

  it('leaves the orphan signal untouched when it learns nothing new', () => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    load(highlight)
    store.orphanIds.value = new Set([highlight.id])
    const orphans = store.orphanIds.value
    orphanUnplaced({ store, painter }, [highlight.id])
    expect(store.orphanIds.value).toBe(orphans)
  })
})
