import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as chatgpt from '@/chatgpt'
import { createPainter, FLASH_MS, type Painter } from '@/painter'
import {
  conversationHtml,
  countPaintedRanges,
  type FakeSettle,
  FIRST_ANSWER_ID,
  FIXTURE_CONVERSATION_ID,
  fakeSettle,
  HIGH_TIDE_QUOTE,
  highlightIn,
  installFakeHighlightApi,
  installFakeScrollIntoView,
  LAST_ANSWER_ID,
  makeOverlayRoot,
  mountFixture,
  OTHER_CONVERSATION_ID,
  PULL_QUOTE,
  requireUnit,
} from '@/testing'
import { anchorUnits } from './anchor-pass'
import { clearJump, type Jump, loadJump, saveJump } from './jump'
import type { Stop } from './listen'
import { REVEAL_TIMEOUT_MS, type Reveal, startReveal } from './reveal'
import { createStore, type Store } from './store'

let registry: HighlightRegistry
let painter: Painter
let store: Store
let hooks: FakeSettle
let scrollIntoView: ReturnType<typeof installFakeScrollIntoView>
const stops: Stop[] = []

const pulled = () => highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)

const begin = (): Reveal => {
  const runtime = { doc: document, store, painter, shadowRoot: makeOverlayRoot() }
  const reveal = startReveal(runtime, hooks.afterSettle)
  stops.push(reveal.stop)
  return reveal
}

const jumpOf = (highlightId: string, conversationId = FIXTURE_CONVERSATION_ID): Jump => ({
  conversationId,
  highlightId,
})

const jumpTo = (highlightId: string, conversationId = FIXTURE_CONVERSATION_ID): void =>
  saveJump(jumpOf(highlightId, conversationId))

const knowing = (...highlights: ReturnType<typeof pulled>[]): void => {
  store.highlights.value = new Map(highlights.map((highlight) => [highlight.id, highlight]))
}

const painted = (): void => {
  anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
  hooks.settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  mountFixture(conversationHtml)
  registry = installFakeHighlightApi()
  painter = createPainter(registry)
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
  hooks = fakeSettle()
  scrollIntoView = installFakeScrollIntoView()
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('a painted target', () => {
  beforeEach(() => {
    knowing(pulled())
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
  })

  it('is scrolled to the center and flashed, then the jump is cleared', () => {
    jumpTo(pulled().id)
    begin()
    expect(scrollIntoView).toHaveBeenCalledWith(chatgpt.CENTERED_SCROLL)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      painter.painted.get(pulled().id)?.range.startContainer.parentElement,
    )
    expect(countPaintedRanges(registry)).toBe(2)
    expect(loadJump()).toBeNull()
  })

  it('stops flashing after the painter lets the flash fade', async () => {
    jumpTo(pulled().id)
    begin()
    await vi.advanceTimersByTimeAsync(FLASH_MS)
    expect(countPaintedRanges(registry)).toBe(1)
  })

  it('does nothing when there is no jump', () => {
    begin()
    hooks.settle()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('reveals only once however many flushes follow', () => {
    jumpTo(pulled().id)
    begin()
    hooks.settle()
    hooks.settle()
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })
})

describe('a jump handed over with track', () => {
  beforeEach(() => {
    knowing(pulled())
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
  })

  it('is revealed at once, without waiting for the next flush', () => {
    const reveal = begin()
    reveal.track(jumpOf(pulled().id))
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(countPaintedRanges(registry)).toBe(2)
  })

  it('clears the jump the page saved for it once it is revealed', () => {
    jumpTo(pulled().id)
    const reveal = begin()
    jumpTo(pulled().id)
    reveal.track(jumpOf(pulled().id))
    expect(loadJump()).toBeNull()
  })

  it('is not looked for in the storage by later flushes', () => {
    begin()
    jumpTo(pulled().id)
    hooks.settle()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('the stored jump', () => {
  it('is read once, at start', () => {
    jumpTo('unknown')
    const read = vi.spyOn(Storage.prototype, 'getItem')
    begin()
    hooks.settle()
    hooks.settle()
    hooks.settle()
    expect(read).toHaveBeenCalledOnce()
  })

  it('is not read at all by a flush when there was none', () => {
    begin()
    const read = vi.spyOn(Storage.prototype, 'getItem')
    hooks.settle()
    expect(read).not.toHaveBeenCalled()
  })
})

describe('a storage the page refuses', () => {
  it('still starts, and reveals a jump handed over with track', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    knowing(pulled())
    anchorUnits({ store, painter }, [requireUnit(FIRST_ANSWER_ID)])
    const reveal = begin()
    hooks.settle()
    reveal.track(jumpOf(pulled().id))
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })
})

describe('a target that is not painted yet', () => {
  it('waits for the anchor pass that paints it', () => {
    knowing(pulled())
    jumpTo(pulled().id)
    begin()
    expect(scrollIntoView).not.toHaveBeenCalled()
    painted()
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(loadJump()).toBeNull()
  })

  it('waits for the conversation to be the one it belongs to', () => {
    knowing(pulled())
    jumpTo(pulled().id, OTHER_CONVERSATION_ID)
    begin()
    painted()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(loadJump()).not.toBeNull()
  })

  it('asks ChatGPT to scroll to its message once when the message is not mounted', () => {
    const scroll = vi.spyOn(chatgpt, 'scrollToMessage').mockReturnValue(true)
    const far = highlightIn(LAST_ANSWER_ID, HIGH_TIDE_QUOTE)
    knowing(far)
    requireUnit(LAST_ANSWER_ID).element.remove()
    jumpTo(far.id)
    begin()
    hooks.settle()
    hooks.settle()
    expect(scroll).toHaveBeenCalledOnce()
    expect(scroll).toHaveBeenCalledWith(document, LAST_ANSWER_ID)
  })

  it('does not scroll when the message is mounted but the quote was not found', () => {
    const scroll = vi.spyOn(chatgpt, 'scrollToMessage')
    knowing(pulled())
    jumpTo(pulled().id)
    begin()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('does not scroll for a highlight the conversation does not have', () => {
    const scroll = vi.spyOn(chatgpt, 'scrollToMessage')
    jumpTo('unknown')
    begin()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('scrolls once more for each new jump', () => {
    const scroll = vi.spyOn(chatgpt, 'scrollToMessage').mockReturnValue(true)
    const far = highlightIn(LAST_ANSWER_ID, HIGH_TIDE_QUOTE)
    const first = pulled()
    knowing(far, first)
    requireUnit(LAST_ANSWER_ID).element.remove()
    requireUnit(FIRST_ANSWER_ID).element.remove()
    jumpTo(far.id)
    const reveal = begin()
    reveal.track(jumpOf(first.id))
    hooks.settle()
    hooks.settle()
    expect(scroll.mock.calls.map(([, messageId]) => messageId)).toEqual([
      LAST_ANSWER_ID,
      FIRST_ANSWER_ID,
    ])
  })
})

describe('expiry', () => {
  it('gives up after 10 seconds and forgets the jump', async () => {
    knowing(pulled())
    jumpTo(pulled().id)
    begin()
    await vi.advanceTimersByTimeAsync(REVEAL_TIMEOUT_MS)
    expect(loadJump()).toBeNull()
    painted()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('is still waiting just before the limit', async () => {
    knowing(pulled())
    jumpTo(pulled().id)
    begin()
    await vi.advanceTimersByTimeAsync(REVEAL_TIMEOUT_MS - 1)
    painted()
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('restarts the clock for a newer jump', async () => {
    knowing(pulled())
    jumpTo('first')
    const reveal = begin()
    await vi.advanceTimersByTimeAsync(REVEAL_TIMEOUT_MS - 1)
    reveal.track(jumpOf(pulled().id))
    await vi.advanceTimersByTimeAsync(REVEAL_TIMEOUT_MS - 1)
    expect(loadJump()).not.toBeNull()
  })
})

describe('stopping', () => {
  it('stops following the flush and cancels the clock', () => {
    knowing(pulled())
    jumpTo(pulled().id)
    const timers = vi.getTimerCount()
    begin()
    for (const stop of stops.splice(0)) stop()
    painted()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(timers)
    clearJump()
  })
})
