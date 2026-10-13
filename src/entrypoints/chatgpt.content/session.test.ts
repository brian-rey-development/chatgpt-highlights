import { fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as anchoring from '@/anchoring'
import * as chatgpt from '@/chatgpt'
import { LIBRARY_ADDRESS, TEXT_ROOT } from '@/chatgpt'
import { err, ok } from '@/errors'
import { ANCHOR_MEASURE, type ConversationHighlights, fieldOf, type Highlight } from '@/model'
import { createPainter, type Painter } from '@/painter'
import {
  addStopButton,
  appendAnsweredTurn,
  cloneElement,
  conversationHtml,
  countPaintedRanges,
  dataChanged,
  deliverMessage,
  EMPTY_LOAD,
  type FakeBackground,
  FIRST_ANSWER_ID,
  FIXTURE_CHAT_PATH,
  FIXTURE_CONVERSATION_ID,
  FIXTURE_DATA_CHANGED,
  fakeActions,
  GONE_QUOTE,
  HIGH_TIDE_QUOTE,
  highlightIn,
  homeHtml,
  installFakeBackground,
  installFakeHighlightApi,
  LAST_ANSWER_ID,
  makeConversation,
  makeHighlight,
  makeOverlayRoot,
  mountFixture,
  NEW_ANSWER_ID,
  nextFrame,
  OTHER_CONVERSATION_ID,
  PULL_QUOTE,
  paintedTexts,
  requireElement,
  requireUnit,
  SPRING_QUOTE,
  settle,
  swapMain,
  threadContainer,
  WRITE_FAILURE,
} from '@/testing'
import { App } from '@/ui'
import * as anchorPass from './anchor-pass'
import { createHighlightActions } from './highlight-actions'
import type { Stop } from './listen'
import { type SessionHandle, startSession } from './session'
import { createStore, LOAD_FAILED_MESSAGE, type Runtime, type Store } from './store'

let registry: HighlightRegistry
let painter: Painter
let store: Store
let library: Map<string, ConversationHighlights>
let background: FakeBackground
const stops: Stop[] = []

const flush = async () => {
  await nextFrame()
  await settle()
}

const touch = async () => {
  threadContainer().append(document.createElement('span'))
  await flush()
}

const stock = (id: string, ...highlights: Highlight[]): void => {
  library.set(id, { conversation: makeConversation({ id }), highlights })
}

const loadCalls = (): unknown[] => background.sent('conversation.load')

const visit = (path: string): void => window.history.pushState(null, '', path)

const makeRuntime = (): Runtime => ({
  doc: document,
  store,
  painter,
  shadowRoot: makeOverlayRoot(),
})

const begin = async (runtime = makeRuntime()): Promise<SessionHandle> => {
  const session = startSession(runtime)
  stops.push(session.stop)
  await flush()
  return session
}

const answerFor = (message: unknown): unknown =>
  ok(library.get(String(fieldOf(message, 'conversationId'))) ?? EMPTY_LOAD)

const holdAnswers = () => {
  const gates = new Map<string, () => void>()
  background.answerWith(
    (message) =>
      new Promise((resolve) => {
        gates.set(String(fieldOf(message, 'conversationId')), () => resolve(answerFor(message)))
      }),
  )
  return (conversationId: string) => gates.get(conversationId)?.()
}

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
  registry = installFakeHighlightApi()
  painter = createPainter(registry)
  store = createStore()
  library = new Map()
  mountFixture(conversationHtml)
  background = installFakeBackground()
  background.answerWith(answerFor)
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('startSession', () => {
  it('loads the conversation once and paints its highlights', async () => {
    stock(
      FIXTURE_CONVERSATION_ID,
      highlightIn(FIRST_ANSWER_ID, PULL_QUOTE),
      highlightIn(LAST_ANSWER_ID, HIGH_TIDE_QUOTE),
    )
    await begin()
    expect(loadCalls()).toEqual([
      { type: 'conversation.load', conversationId: FIXTURE_CONVERSATION_ID },
    ])
    expect(store.conversationId.value).toBe(FIXTURE_CONVERSATION_ID)
    expect(store.conversation.value?.id).toBe(FIXTURE_CONVERSATION_ID)
    expect(paintedTexts(painter).toSorted()).toEqual([HIGH_TIDE_QUOTE, PULL_QUOTE])
  })

  it('paints nothing into a conversation that stays mounted but hidden', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    swapMain(homeHtml)
    await begin()
    expect(paintedTexts(painter)).toEqual([])
  })

  it('asks for nothing on a page that is not a conversation', async () => {
    visit('/')
    await begin()
    expect(loadCalls()).toEqual([])
    expect(store.conversationId.value).toBeNull()
  })

  it('does no anchoring work on a chat without highlights', async () => {
    const read = vi.spyOn(anchoring, 'readMessageText')
    await begin()
    expect(loadCalls()).toHaveLength(1)
    expect(read).not.toHaveBeenCalled()
  })

  it('reads no text for units whose message has no highlights', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const read = vi.spyOn(anchoring, 'readMessageText')
    await begin()
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0]?.[0]).toBe(
      requireElement(TEXT_ROOT, requireUnit(FIRST_ANSWER_ID).element),
    )
  })

  it('keeps the conversation when only the path around its id changes', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    visit(`/g/g-p-abc/c/${FIXTURE_CONVERSATION_ID}`)
    await touch()
    expect(loadCalls()).toHaveLength(1)
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
  })

  it('records a quote that cannot be found as an orphan and paints nothing for it', async () => {
    const lost = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'lost' })
    stock(FIXTURE_CONVERSATION_ID, {
      ...lost,
      quote: { ...lost.quote, exact: GONE_QUOTE },
    })
    await begin()
    expect([...store.orphanIds.value]).toEqual(['lost'])
    expect(painter.painted.size).toBe(0)
  })

  it('shows a toast when the highlights cannot be loaded', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    await begin()
    expect(store.toast.value?.message).toBe(LOAD_FAILED_MESSAGE)
    expect(painter.painted.size).toBe(0)
  })
})

describe('data.changed', () => {
  it('reloads the current conversation and repaints it', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { color: 'blue' }))
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect(loadCalls()).toHaveLength(2)
    expect(countPaintedRanges(registry)).toBe(1)
    expect([...painter.painted.values()]).toMatchObject([{ color: 'blue' }])
  })

  it('forgets the orphans of highlights that no longer exist', async () => {
    const lost = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'lost' })
    stock(FIXTURE_CONVERSATION_ID, {
      ...lost,
      quote: { ...lost.quote, exact: GONE_QUOTE },
    })
    await begin()
    expect(store.orphanIds.value.size).toBe(1)
    stock(FIXTURE_CONVERSATION_ID)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect(store.orphanIds.value.size).toBe(0)
  })

  it('ignores a change to another conversation', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    await deliverMessage(dataChanged(OTHER_CONVERSATION_ID))
    await flush()
    expect(loadCalls()).toHaveLength(1)
  })

  it('keeps the highlights painted when a reload lands during generation', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    vi.spyOn(chatgpt, 'isGenerating').mockReturnValue(true)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
  })

  it('unpaints a highlight deleted elsewhere at once, even while generating', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    vi.spyOn(chatgpt, 'isGenerating').mockReturnValue(true)
    stock(FIXTURE_CONVERSATION_ID)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect(painter.painted.size).toBe(0)
  })

  it('keeps the orphans of surviving highlights while a response is generating', async () => {
    const lost = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE, { id: 'lost' })
    stock(FIXTURE_CONVERSATION_ID, {
      ...lost,
      quote: { ...lost.quote, exact: GONE_QUOTE },
    })
    await begin()
    vi.spyOn(chatgpt, 'isGenerating').mockReturnValue(true)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect([...store.orphanIds.value]).toEqual(['lost'])
  })

  it('drops a load that answers after the session stopped', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const release = holdAnswers()
    const { stop } = await begin()
    stop()
    release(FIXTURE_CONVERSATION_ID)
    await flush()
    expect(store.conversation.value).toBeNull()
    expect(painter.painted.size).toBe(0)
  })

  it('has nothing to reload on a page that is not a conversation', async () => {
    visit('/')
    await begin()
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await flush()
    expect(loadCalls()).toEqual([])
  })

  it('stops listening and watching once the session is stopped', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const { stop } = await begin()
    stop()
    const read = vi.spyOn(anchoring, 'readMessageText')
    await deliverMessage(FIXTURE_DATA_CHANGED)
    await touch()
    expect(loadCalls()).toHaveLength(1)
    expect(read).not.toHaveBeenCalled()
  })
})

describe('conversation change', () => {
  beforeEach(() => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    stock(
      OTHER_CONVERSATION_ID,
      highlightIn(FIRST_ANSWER_ID, SPRING_QUOTE, { conversationId: OTHER_CONVERSATION_ID }),
      highlightIn(LAST_ANSWER_ID, HIGH_TIDE_QUOTE, { conversationId: OTHER_CONVERSATION_ID }),
    )
  })

  it('loads the new conversation once and anchors every mounted unit', async () => {
    await begin()
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(loadCalls()).toHaveLength(2)
    expect(loadCalls()[1]).toEqual({
      type: 'conversation.load',
      conversationId: OTHER_CONVERSATION_ID,
    })
    expect(paintedTexts(painter).toSorted()).toEqual([HIGH_TIDE_QUOTE, SPRING_QUOTE])
    expect(store.conversationId.value).toBe(OTHER_CONVERSATION_ID)
  })

  it('shows nothing of the old conversation while the new one loads', async () => {
    await begin()
    const release = holdAnswers()
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(painter.painted.size).toBe(0)
    expect(store.highlights.value.size).toBe(0)
    release(OTHER_CONVERSATION_ID)
    await flush()
    expect(painter.painted.size).toBe(2)
  })

  it('closes the pill and the popover of the old conversation', async () => {
    await begin()
    store.pill.value = { anchor: new DOMRect(), dock: null }
    store.popover.value = { highlight: makeHighlight(), anchor: new DOMRect() }
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(store.pill.value).toBeNull()
    expect(store.popover.value).toBeNull()
  })

  it('keeps a note typed just before the user goes back', async () => {
    const runtime = makeRuntime()
    await begin(runtime)
    const actions = { ...fakeActions(), ...createHighlightActions(runtime, { close: vi.fn() }) }
    render(h(App, { state: store, actions }))
    const [highlight] = store.highlights.value.values()
    if (!highlight) throw new Error('the fixture highlight did not load')
    store.popover.value = { highlight, anchor: new DOMRect() }
    await settle()
    fireEvent.input(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'typed' } })
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(background.sent('highlight.update')).toEqual([
      { type: 'highlight.update', id: highlight.id, patch: { note: 'typed' } },
    ])
  })

  it('forgets the orphans of the old conversation', async () => {
    await begin()
    store.orphanIds.value = new Set(['stale'])
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(store.orphanIds.value.size).toBe(0)
  })

  it('empties everything on a page that is not a conversation', async () => {
    await begin()
    visit('/')
    await touch()
    expect(loadCalls()).toHaveLength(1)
    expect(painter.painted.size).toBe(0)
    expect(store.conversationId.value).toBeNull()
  })

  it('drops the answer for a conversation the person already left', async () => {
    const release = holdAnswers()
    await begin()
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    release(FIXTURE_CONVERSATION_ID)
    await flush()
    expect(painter.painted.size).toBe(0)
    expect(store.conversation.value).toBeNull()
    release(OTHER_CONVERSATION_ID)
    await flush()
    expect(store.conversation.value?.id).toBe(OTHER_CONVERSATION_ID)
    expect(paintedTexts(painter).toSorted()).toEqual([HIGH_TIDE_QUOTE, SPRING_QUOTE])
  })
})

describe('later flushes', () => {
  beforeEach(() => {
    stock(
      FIXTURE_CONVERSATION_ID,
      highlightIn(FIRST_ANSWER_ID, PULL_QUOTE),
      highlightIn(FIRST_ANSWER_ID, SPRING_QUOTE, { id: 'new-message', messageId: NEW_ANSWER_ID }),
    )
  })

  it('anchor only the units that were touched', async () => {
    await begin()
    const read = vi.spyOn(anchoring, 'readMessageText')
    const added = appendAnsweredTurn(NEW_ANSWER_ID)
    await flush()
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0]?.[0]).toBe(requireElement(TEXT_ROOT, added))
    expect(painter.painted.has('new-message')).toBe(true)
  })

  it('run no anchor pass when no unit was touched', async () => {
    await begin()
    const pass = vi.spyOn(anchorPass, 'anchorUnits')
    await touch()
    expect(pass).not.toHaveBeenCalled()
  })

  it('repaint a highlight whose message was replaced by an identical node', async () => {
    await begin()
    const original = requireUnit(FIRST_ANSWER_ID).element
    const replacement = cloneElement(original)
    original.replaceWith(replacement)
    await flush()
    const range = painter.painted.get(`${FIRST_ANSWER_ID}-${PULL_QUOTE}`)?.range
    expect(range?.toString()).toBe(PULL_QUOTE)
    expect(replacement.contains(range?.startContainer ?? null)).toBe(true)
    expect(countPaintedRanges(registry)).toBe(1)
  })

  it('skip a unit whose text has not rendered yet', async () => {
    await begin()
    const read = vi.spyOn(anchoring, 'readMessageText')
    requireElement(TEXT_ROOT, requireUnit(FIRST_ANSWER_ID).element).remove()
    await flush()
    expect(read).not.toHaveBeenCalled()
  })

  it('prune the highlights of units that left the page', async () => {
    await begin()
    requireUnit(FIRST_ANSWER_ID).element.remove()
    await flush()
    expect(painter.painted.size).toBe(0)
    expect(countPaintedRanges(registry)).toBe(0)
  })
})

describe('while a response is generating', () => {
  beforeEach(() => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
  })

  it('anchors nothing until it ends, then anchors every mounted unit', async () => {
    const generating = vi.spyOn(chatgpt, 'isGenerating').mockReturnValue(true)
    await begin()
    await touch()
    expect(painter.painted.size).toBe(0)
    generating.mockReturnValue(false)
    await touch()
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
  })

  it('anchors what changed during generation as soon as the stop button goes', async () => {
    const stopButton = addStopButton()
    await begin()
    const original = requireUnit(FIRST_ANSWER_ID).element
    original.replaceWith(cloneElement(original))
    await flush()
    expect(painter.painted.size).toBe(0)
    stopButton.remove()
    await flush()
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
  })

  it('keeps the units touched meanwhile for the first flush after it ends', async () => {
    await begin()
    const generating = vi.spyOn(chatgpt, 'isGenerating').mockReturnValue(true)
    const read = vi.spyOn(anchoring, 'readMessageText')
    const original = requireUnit(FIRST_ANSWER_ID).element
    requireElement('p', original).append(document.createElement('em'))
    const replacement = cloneElement(original)
    original.replaceWith(replacement)
    await flush()
    expect(read).not.toHaveBeenCalled()
    generating.mockReturnValue(false)
    await touch()
    expect(read).toHaveBeenCalledTimes(1)
    const range = painter.painted.get(`${FIRST_ANSWER_ID}-${PULL_QUOTE}`)?.range
    expect(replacement.contains(range?.startContainer ?? null)).toBe(true)
  })
})

describe('settle hooks', () => {
  it('run after a flush has painted its units', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const seen: number[] = []
    const session = await begin()
    stops.push(session.afterSettle(() => seen.push(painter.painted.size)))
    await touch()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toBe(1)
  })

  it('run once the load answered and its highlights are painted', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    const seen: number[] = []
    visit('/')
    const session = await begin()
    stops.push(session.afterSettle(() => seen.push(painter.painted.size)))
    visit(FIXTURE_CHAT_PATH)
    await touch()
    expect(seen).toContain(1)
  })

  it('stay quiet while a response is generating and run once when it ends', async () => {
    const hook = vi.fn()
    const stopButton = addStopButton()
    const session = await begin()
    stops.push(session.afterSettle(hook))
    await touch()
    await touch()
    await touch()
    expect(hook).not.toHaveBeenCalled()
    stopButton.remove()
    await touch()
    expect(hook).toHaveBeenCalledOnce()
  })

  it('stop running once the hook is disposed', async () => {
    const hook = vi.fn()
    const session = await begin()
    session.afterSettle(hook)()
    await touch()
    expect(hook).not.toHaveBeenCalled()
  })

  it('stay quiet after the session stops', async () => {
    const hook = vi.fn()
    const session = await begin()
    stops.push(session.afterSettle(hook))
    session.stop()
    hook.mockClear()
    await touch()
    expect(hook).not.toHaveBeenCalled()
  })
})

describe('the hl:anchor measure', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    performance.clearMeasures()
  })

  it('is not recorded outside the e2e build', async () => {
    stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
    await begin()
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
    expect(performance.getEntriesByName(ANCHOR_MEASURE)).toEqual([])
  })

  describe('in an e2e build', () => {
    let startE2eSession: typeof startSession

    beforeEach(async () => {
      vi.stubEnv('MODE', 'e2e')
      vi.resetModules()
      startE2eSession = (await import('./session')).startSession
      painter = (await import('@/painter')).createPainter(registry)
    })

    const beginE2e = async (): Promise<void> => {
      stops.push(startE2eSession(makeRuntime()).stop)
      await flush()
    }

    it('times the anchoring pass of a page load exactly once', async () => {
      stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
      const release = holdAnswers()
      await beginE2e()
      performance.clearMeasures()
      release(FIXTURE_CONVERSATION_ID)
      await flush()
      expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
      expect(performance.getEntriesByName(ANCHOR_MEASURE)).toHaveLength(1)
    })

    it('times the pass after a reload exactly once', async () => {
      stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE))
      await beginE2e()
      performance.clearMeasures()
      await deliverMessage(FIXTURE_DATA_CHANGED)
      await flush()
      const [measure, ...others] = performance.getEntriesByName(ANCHOR_MEASURE)
      expect(measure?.duration).toBeGreaterThanOrEqual(0)
      expect(others).toHaveLength(0)
    })
  })
})

describe('a view sitting over the conversation', () => {
  beforeEach(() => stock(FIXTURE_CONVERSATION_ID, highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)))

  const openView = (over: string | null): void => {
    store.libraryOver.value = over
    window.history.pushState(null, '', LIBRARY_ADDRESS)
  }

  it('keeps the conversation loaded while the address reads /#highlights', async () => {
    await begin()
    openView(FIXTURE_CONVERSATION_ID)
    await touch()
    expect(store.conversationId.value).toBe(FIXTURE_CONVERSATION_ID)
    expect(loadCalls()).toHaveLength(1)
    expect(paintedTexts(painter)).toEqual([PULL_QUOTE])
  })

  it('follows the page again once the address leaves the view for another chat', async () => {
    await begin()
    openView(FIXTURE_CONVERSATION_ID)
    await touch()
    visit(`/c/${OTHER_CONVERSATION_ID}`)
    await touch()
    expect(store.conversationId.value).toBe(OTHER_CONVERSATION_ID)
    expect(loadCalls()).toHaveLength(2)
  })

  it('follows the page when the view is not over a conversation', async () => {
    await begin()
    openView(null)
    await touch()
    expect(store.conversationId.value).toBeNull()
    expect(painter.painted.size).toBe(0)
  })
})
