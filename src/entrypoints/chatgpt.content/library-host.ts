import {
  conversationIdFromPath,
  ensureSidebarItem,
  isItemShown,
  LIBRARY_ADDRESS,
  LIBRARY_HASH,
  mainPane,
  OPEN_ATTR,
  SIDEBAR_LINK,
} from '@/chatgpt'
import { onEvent, onTabCommand, request } from '@/messaging'
import { onEscape } from './escape-key'
import { followMain, type MainFollow } from './library-main'
import { listen, type Stop } from './listen'
import type { AfterSettle } from './session'
import { LOAD_FAILED_MESSAGE, type Runtime, showMessage } from './store'

export interface LibraryHost {
  open: () => void
  close: () => void
  closeInPlace: () => void
  stop: Stop
}

interface View {
  follow: MainFollow
  pushed: boolean
  origin: string
  openedIn: string | null
  loads: number
  stops: Stop[]
}

interface CloseOptions {
  restoreHistory: boolean
  replaceEntry: boolean
}

interface OpenOptions {
  pushEntry: boolean
}

const RESTORE_HISTORY: CloseOptions = { restoreHistory: true, replaceEntry: false }
const REPLACE_ENTRY: CloseOptions = { restoreHistory: true, replaceEntry: true }
const LEAVE_HISTORY: CloseOptions = { restoreHistory: false, replaceEntry: false }
const REUSE_ENTRY: OpenOptions = { pushEntry: false }
const PUSH_ENTRY: OpenOptions = { pushEntry: true }

interface HostState {
  runtime: Runtime
  view: View | null
  item: HTMLElement | null
  itemWatch: ResizeObserver | null
  launching: boolean
}

const markOpen = (doc: Document): Stop => {
  doc.documentElement.setAttribute(OPEN_ATTR, '')
  return () => doc.documentElement.removeAttribute(OPEN_ATTR)
}

const leavesLibrary = (state: HostState, event: MouseEvent): boolean => {
  const { target } = event
  if (!(target instanceof Element) || !target.closest(SIDEBAR_LINK)) return false
  return !state.item?.contains(target)
}

const leaveHistory = (doc: Document, view: View, { replaceEntry }: CloseOptions): void => {
  if (doc.location.hash !== LIBRARY_HASH) return
  // Pushing moved the path to /, so use the saved one
  if (view.pushed && !replaceEntry) history.back()
  else history.replaceState(history.state, '', view.origin)
}

const closeView = (state: HostState, options: CloseOptions): void => {
  const { view } = state
  if (!view) return
  const { doc, store } = state.runtime
  state.view = null
  for (const stop of view.stops) stop()
  store.library.value = null
  store.libraryFrame.value = null
  if (options.restoreHistory) leaveHistory(doc, view, options)
}

const loadSnapshot = async (state: HostState, view: View): Promise<void> => {
  const { store } = state.runtime
  const ticket = view.loads + 1
  view.loads = ticket
  const result = await request({ type: 'library.snapshot' })
  if (state.view !== view || view.loads !== ticket) return
  if (result.ok) {
    store.library.value = { snapshot: result.data, now: Date.now() }
    return
  }
  showMessage(store, LOAD_FAILED_MESSAGE)
  if (store.library.value === null) closeView(state, RESTORE_HISTORY)
}

const watchView = (state: HostState, view: View): Stop[] => {
  const { doc, store, shadowRoot } = state.runtime
  const { openedIn } = view
  const dismiss = (): void => closeView(state, LEAVE_HISTORY)
  const onClick = (event: MouseEvent): void => {
    if (leavesLibrary(state, event)) dismiss()
  }
  const onConversation = (id: string | null): void => {
    if (id !== openedIn && id === conversationIdFromPath(doc.location.pathname)) dismiss()
  }
  return [
    onEscape([doc, shadowRoot], () => closeView(state, RESTORE_HISTORY)),
    listen(doc, { type: 'click', capture: true }, onClick),
    store.conversationId.subscribe(onConversation),
    onEvent(() => void loadSnapshot(state, view)),
  ]
}

const openView = (state: HostState, { pushEntry }: OpenOptions): void => {
  const { doc, store } = state.runtime
  const main = mainPane(doc)
  if (state.view || !main) return
  const openedIn = conversationIdFromPath(doc.location.pathname)
  const origin = doc.location.pathname + doc.location.search
  if (pushEntry) history.pushState(null, '', LIBRARY_ADDRESS)
  const follow = followMain(state.runtime, main)
  const view: View = { follow, pushed: pushEntry, origin, openedIn, loads: 0, stops: [] }
  state.view = view
  store.libraryOver.value = pushEntry ? openedIn : null
  store.pill.value = null
  store.popover.value = null
  view.stops.push(markOpen(doc), follow.stop, ...watchView(state, view))
  void loadSnapshot(state, view)
}

const launch = (state: HostState): void => {
  if (!state.launching) return
  const wanted = state.runtime.doc.location.hash === LIBRARY_HASH
  if (wanted) openView(state, REUSE_ENTRY)
  state.launching = wanted && state.view === null
}

const followHistory = (state: HostState): void => {
  if (state.runtime.doc.location.hash === LIBRARY_HASH) openView(state, REUSE_ENTRY)
  else closeView(state, LEAVE_HISTORY)
}

const closeWhenAddressLeft = (state: HostState): void => {
  if (state.view && state.runtime.doc.location.hash !== LIBRARY_HASH) {
    closeView(state, LEAVE_HISTORY)
  }
}

const keepItemShown = (state: HostState, open: () => void): void => {
  if (isItemShown(state.item)) return
  if (state.item) state.itemWatch?.unobserve(state.item)
  state.item = ensureSidebarItem(state.runtime.doc, open)
  if (state.item) state.itemWatch?.observe(state.item)
}

const followSettledPage = (state: HostState, open: () => void): void => {
  closeWhenAddressLeft(state)
  state.view?.follow.refresh()
  keepItemShown(state, open)
  launch(state)
}

const watchItem = (state: HostState, open: () => void): Stop => {
  let frame: number | null = null
  const observer = new ResizeObserver(() => {
    if (frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      keepItemShown(state, open)
    })
  })
  state.itemWatch = observer
  return () => {
    observer.disconnect()
    if (frame !== null) cancelAnimationFrame(frame)
  }
}

const watchHost = (state: HostState, open: () => void, afterSettle: AfterSettle): Stop => {
  const stops = [
    watchItem(state, open),
    afterSettle(() => followSettledPage(state, open)),
    onTabCommand(open),
    listen(window, { type: 'popstate' }, () => followHistory(state)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
}

export const startLibraryHost = (runtime: Runtime, afterSettle: AfterSettle): LibraryHost => {
  const launching = runtime.doc.location.hash === LIBRARY_HASH
  const state: HostState = { runtime, view: null, item: null, itemWatch: null, launching }
  const open = (): void => openView(state, PUSH_ENTRY)
  const stopWatching = watchHost(state, open, afterSettle)
  launch(state)
  return {
    open,
    close: () => closeView(state, RESTORE_HISTORY),
    closeInPlace: () => closeView(state, REPLACE_ENTRY),
    stop: () => {
      closeView(state, LEAVE_HISTORY)
      stopWatching()
      state.item?.remove()
      state.item = null
    },
  }
}
