import { conversationIdFromPath, isGenerating, LIBRARY_HASH, unitElements, unitOf } from '@/chatgpt'
import { type AppEvent, onEvent, request } from '@/messaging'
import { ANCHOR_MEASURE, type ConversationHighlights, type Highlight } from '@/model'
import { prune, unpaint, unpaintAll } from '@/painter'
import { anchorUnits } from './anchor-pass'
import { IS_E2E_BUILD } from './build-mode'
import type { Stop } from './listen'
import { LOAD_FAILED_MESSAGE, type Runtime, showMessage } from './store'
import { createWatcher, type Flush } from './watcher'

export type AfterSettle = (hook: () => void) => Stop

export interface SessionHandle {
  stop: Stop
  afterSettle: AfterSettle
}

interface SessionState {
  runtime: Runtime
  pending: Set<Element>
  retries: Map<Element, number>
  retryTimer: ReturnType<typeof setTimeout> | null
  hooks: Set<() => void>
  epoch: number
  loaded: boolean
}

const FIRST_RETRY_MS = 250
const SECOND_RETRY_MS = 1000
const LAST_RETRY_MS = 4000

// ChatGPT renders some messages in stages, and a stage can end without any node or text change
export const RETRY_DELAYS_MS = [FIRST_RETRY_MS, SECOND_RETRY_MS, LAST_RETRY_MS] as const

const NO_ORPHANS: ReadonlySet<string> = new Set()

const connectedUnits = (elements: readonly Element[]) =>
  elements.filter((element) => element.isConnected).flatMap((element) => unitOf(element) ?? [])

const streamingUnit = (doc: Document): Element | null => {
  const units = unitElements(doc)
  return units.item(units.length - 1)
}

const takeReady = ({ runtime, pending }: SessionState, generating: boolean): Element[] => {
  const held = generating ? streamingUnit(runtime.doc) : null
  const ready = [...pending].filter((element) => element !== held)
  for (const element of ready) pending.delete(element)
  return ready
}

const noteMisses = ({ retries }: SessionState, ready: readonly Element[], missed: Element[]) => {
  for (const element of ready) {
    if (!missed.includes(element)) retries.delete(element)
    else if (!retries.has(element)) retries.set(element, 0)
  }
}

const anchorPending = (state: SessionState, generating: boolean): void => {
  const { runtime, pending, loaded } = state
  const { store, painter } = runtime
  if (!loaded || store.highlights.value.size === 0) {
    pending.clear()
    return
  }
  if (painter.painted.size > 0) prune(painter)
  const ready = takeReady(state, generating)
  if (ready.length === 0) return
  noteMisses(state, ready, anchorUnits(runtime, connectedUnits(ready)))
}

const measureAnchoring = (state: SessionState, generating: boolean): void => {
  const start = performance.now()
  anchorPending(state, generating)
  performance.measure(ANCHOR_MEASURE, { start })
}

const anchor = IS_E2E_BUILD ? measureAnchoring : anchorPending

const clearRetries = (state: SessionState): void => {
  state.retries.clear()
  if (state.retryTimer !== null) clearTimeout(state.retryTimer)
  state.retryTimer = null
}

const scheduleRetry = (state: SessionState, retry: () => void): void => {
  const { retries } = state
  for (const [element, used] of retries) {
    if (used >= RETRY_DELAYS_MS.length) retries.delete(element)
  }
  if (state.retryTimer !== null || retries.size === 0) return
  const delay = RETRY_DELAYS_MS[Math.min(...retries.values())] ?? 0
  state.retryTimer = setTimeout(retry, delay)
}

const queueRetries = (state: SessionState): void => {
  state.retryTimer = null
  for (const [element, used] of state.retries) {
    if (!element.isConnected || used >= RETRY_DELAYS_MS.length) state.retries.delete(element)
    else state.retries.set(element, used + 1)
    if (state.retries.has(element)) state.pending.add(element)
  }
}

const settle = (state: SessionState): void => {
  const generating = isGenerating(state.runtime.doc)
  anchor(state, generating)
  scheduleRetry(state, () => {
    queueRetries(state)
    settle(state)
  })
  if (generating) return
  for (const hook of state.hooks) hook()
}

const resetConversation = (state: SessionState, conversationId: string | null): void => {
  const { store, painter } = state.runtime
  state.epoch += 1
  state.loaded = conversationId === null
  clearRetries(state)
  unpaintAll(painter)
  store.conversationId.value = conversationId
  store.conversation.value = null
  store.highlights.value = new Map()
  store.orphanIds.value = NO_ORPHANS
  store.pill.value = null
  store.popover.value = null
}

const keepOnly = ({ painter, store }: Runtime, kept: ReadonlyMap<string, Highlight>): void => {
  for (const id of [...painter.painted.keys()]) {
    if (!kept.has(id)) unpaint(painter, id)
  }
  const orphans = [...store.orphanIds.value].filter((id) => kept.has(id))
  if (orphans.length < store.orphanIds.value.size) store.orphanIds.value = new Set(orphans)
}

const adopt = (state: SessionState, loaded: ConversationHighlights): void => {
  const { runtime, pending } = state
  const { store, doc } = runtime
  const highlights = new Map(loaded.highlights.map((highlight) => [highlight.id, highlight]))
  keepOnly(runtime, highlights)
  clearRetries(state)
  store.conversation.value = loaded.conversation
  store.highlights.value = highlights
  state.loaded = true
  if (highlights.size === 0) return
  for (const element of unitElements(doc)) pending.add(element)
}

const loadCurrent = async (state: SessionState): Promise<void> => {
  const { store } = state.runtime
  const conversationId = store.conversationId.value
  if (conversationId === null) return
  state.epoch += 1
  const epoch = state.epoch
  const result = await request({ type: 'conversation.load', conversationId })
  if (epoch !== state.epoch) return
  if (!result.ok) {
    showMessage(store, LOAD_FAILED_MESSAGE)
    return
  }
  adopt(state, result.data)
  settle(state)
}

const viewIsOverConversation = ({ doc, store }: Runtime): boolean =>
  store.libraryOver.value !== null && doc.location.hash === LIBRARY_HASH

const followPath = (state: SessionState): void => {
  const { doc, store } = state.runtime
  if (viewIsOverConversation(state.runtime)) return
  const conversationId = conversationIdFromPath(doc.location.pathname)
  if (conversationId === store.conversationId.value) return
  resetConversation(state, conversationId)
  void loadCurrent(state)
}

const onFlush = (state: SessionState, flush: Flush): void => {
  if (flush.addressChanged) followPath(state)
  for (const unit of flush.units) {
    state.retries.delete(unit)
    state.pending.add(unit)
  }
  settle(state)
}

const reloadIfTouched = (state: SessionState, event: AppEvent): void => {
  const conversationId = state.runtime.store.conversationId.value
  if (conversationId !== null && event.conversationIds.includes(conversationId)) {
    void loadCurrent(state)
  }
}

const addHook = (state: SessionState, hook: () => void): Stop => {
  state.hooks.add(hook)
  return () => {
    state.hooks.delete(hook)
  }
}

export const startSession = (runtime: Runtime): SessionHandle => {
  const state: SessionState = {
    runtime,
    pending: new Set(),
    retries: new Map(),
    retryTimer: null,
    hooks: new Set(),
    epoch: 0,
    loaded: true,
  }
  const watcher = createWatcher(runtime.doc, (flush) => onFlush(state, flush))
  const stopEvents = onEvent((event) => reloadIfTouched(state, event))
  watcher.requestFull()
  return {
    afterSettle: (hook) => addHook(state, hook),
    stop: () => {
      state.epoch += 1
      clearRetries(state)
      watcher.stop()
      stopEvents()
    },
  }
}
