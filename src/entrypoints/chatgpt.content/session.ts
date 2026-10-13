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
  hooks: Set<() => void>
  epoch: number
  loaded: boolean
}

const NO_ORPHANS: ReadonlySet<string> = new Set()

const connectedUnits = (pending: ReadonlySet<Element>) =>
  [...pending].filter((element) => element.isConnected).flatMap((element) => unitOf(element) ?? [])

const anchorPending = ({ runtime, pending, loaded }: SessionState): void => {
  const { store, painter } = runtime
  if (!loaded || store.highlights.value.size === 0) {
    pending.clear()
    return
  }
  if (painter.painted.size > 0) prune(painter)
  if (pending.size > 0) anchorUnits(runtime, connectedUnits(pending))
  pending.clear()
}

const measureAnchoring = (state: SessionState): void => {
  const start = performance.now()
  anchorPending(state)
  performance.measure(ANCHOR_MEASURE, { start })
}

const anchor = IS_E2E_BUILD ? measureAnchoring : anchorPending

const settle = (state: SessionState): void => {
  if (isGenerating(state.runtime.doc)) return
  anchor(state)
  for (const hook of state.hooks) hook()
}

const resetConversation = (state: SessionState, conversationId: string | null): void => {
  const { store, painter } = state.runtime
  state.epoch += 1
  state.loaded = conversationId === null
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
  for (const unit of flush.units) state.pending.add(unit)
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
      watcher.stop()
      stopEvents()
    },
  }
}
