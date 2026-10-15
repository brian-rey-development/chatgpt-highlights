import {
  composerForm,
  GENERATION_ATTRS,
  MESSAGE_UNIT,
  READABILITY_ATTRS,
  threadRoot,
  unitElementOf,
  unitElements,
} from '@/chatgpt'
import type { Stop } from './listen'

export interface Flush {
  units: ReadonlySet<Element>
  addressChanged: boolean
}

interface WatcherState {
  doc: Document
  onFlush: (flush: Flush) => void
  observer: MutationObserver
  units: Set<Element>
  added: Set<Element>
  root: Element | null
  form: Element | null
  address: string | null
  frame: number | null
  wantsAllUnits: boolean
}

// aria-hidden and hidden decide which text a message exposes, and ChatGPT flips them as it renders
const THREAD_OPTIONS: MutationObserverInit = {
  childList: true,
  characterData: true,
  subtree: true,
  attributeFilter: [...READABILITY_ATTRS],
}
const SPINE_OPTIONS = { childList: true } as const
const COMPOSER_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributeFilter: [...GENERATION_ATTRS],
}

const noteRecord = (state: WatcherState, record: MutationRecord): void => {
  const unit = unitElementOf(record.target)
  if (unit) {
    state.units.add(unit)
    return
  }
  for (const node of record.addedNodes) {
    if (node instanceof Element) state.added.add(node)
  }
}

const unitsAddedWith = (root: Element): Iterable<Element> => {
  const own = root.closest(MESSAGE_UNIT)
  return own ? [own] : root.querySelectorAll(MESSAGE_UNIT)
}

const collectAdded = (state: WatcherState): void => {
  for (const root of state.added) {
    if (!root.isConnected) continue
    for (const unit of unitsAddedWith(root)) state.units.add(unit)
  }
  state.added.clear()
}

// Any ancestor can be rebuilt unseen, so watch them all
const spineOf = (root: Element): Element[] => {
  const spine: Element[] = []
  for (let node = root.parentElement; node; node = node.parentElement) spine.push(node)
  return spine
}

const observeThread = (state: WatcherState): void => {
  const root = threadRoot(state.doc) ?? state.doc.body
  const form = composerForm(state.doc)
  if (root === state.root && form === state.form) return
  state.observer.disconnect()
  state.observer.observe(root, THREAD_OPTIONS)
  for (const node of spineOf(root)) state.observer.observe(node, SPINE_OPTIONS)
  if (form) state.observer.observe(form, COMPOSER_OPTIONS)
  state.root = root
  state.form = form
}

const takeUnits = (state: WatcherState): ReadonlySet<Element> => {
  collectAdded(state)
  if (state.wantsAllUnits) {
    for (const unit of unitElements(state.doc)) state.units.add(unit)
    state.wantsAllUnits = false
  }
  const units = state.units
  state.units = new Set()
  return units
}

const flush = (state: WatcherState): void => {
  state.frame = null
  observeThread(state)
  const units = takeUnits(state)
  const { pathname, hash } = state.doc.location
  const address = pathname + hash
  const addressChanged = address !== state.address
  state.address = address
  state.onFlush({ units, addressChanged })
}

const schedule = (state: WatcherState): void => {
  if (state.frame !== null) return
  state.frame = requestAnimationFrame(() => flush(state))
}

const createWatcherState = (doc: Document, onFlush: (flush: Flush) => void): WatcherState => {
  const state: WatcherState = {
    doc,
    onFlush,
    observer: new MutationObserver((records) => {
      for (const record of records) noteRecord(state, record)
      schedule(state)
    }),
    units: new Set(),
    added: new Set(),
    root: null,
    form: null,
    address: null,
    frame: null,
    wantsAllUnits: false,
  }
  return state
}

export const createWatcher = (
  doc: Document,
  onFlush: (flush: Flush) => void,
): { stop: Stop; requestFull: () => void } => {
  const state = createWatcherState(doc, onFlush)
  observeThread(state)
  return {
    stop: () => {
      state.observer.disconnect()
      if (state.frame !== null) cancelAnimationFrame(state.frame)
    },
    requestFull: () => {
      state.wantsAllUnits = true
      schedule(state)
    },
  }
}
