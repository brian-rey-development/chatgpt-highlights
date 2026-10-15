import {
  conversationIdFromPath,
  LIBRARY_ADDRESS,
  LIBRARY_HASH,
  mainPane,
  OPEN_ATTR,
  SIDEBAR_LINK,
} from '@/chatgpt'
import { onEvent, onTabCommand, request } from '@/messaging'
import { onEscape } from './escape-key'
import { followMain, type MainFollow } from './library-main'
import { type NavEntry, startNavEntry } from './library-nav-entry'
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
  isPushed: boolean
  origin: string
  openedIn: string | null
  loads: number
  stops: Stop[]
}

interface CloseOptions {
  shouldRestoreHistory: boolean
  shouldReplaceEntry: boolean
}

interface OpenOptions {
  shouldPushEntry: boolean
}

const RESTORE_HISTORY: CloseOptions = { shouldRestoreHistory: true, shouldReplaceEntry: false }
const REPLACE_ENTRY: CloseOptions = { shouldRestoreHistory: true, shouldReplaceEntry: true }
const LEAVE_HISTORY: CloseOptions = { shouldRestoreHistory: false, shouldReplaceEntry: false }
const REUSE_ENTRY: OpenOptions = { shouldPushEntry: false }
const PUSH_ENTRY: OpenOptions = { shouldPushEntry: true }

interface HostState {
  runtime: Runtime
  view: View | null
  navEntry: NavEntry
  isLaunching: boolean
}

const markOpen = (doc: Document): Stop => {
  doc.documentElement.setAttribute(OPEN_ATTR, '')
  return () => doc.documentElement.removeAttribute(OPEN_ATTR)
}

const leavesLibrary = (state: HostState, event: MouseEvent): boolean => {
  const { target } = event
  if (!(target instanceof Element) || !target.closest(SIDEBAR_LINK)) return false
  return !state.navEntry.contains(target)
}

const leaveHistory = (doc: Document, view: View, { shouldReplaceEntry }: CloseOptions): void => {
  if (doc.location.hash !== LIBRARY_HASH) return
  // Pushing moved the path to /, so use the saved one
  if (view.isPushed && !shouldReplaceEntry) history.back()
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
  if (options.shouldRestoreHistory) leaveHistory(doc, view, options)
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

const openView = (state: HostState, { shouldPushEntry }: OpenOptions): void => {
  const { doc, store } = state.runtime
  const main = mainPane(doc)
  if (state.view || !main) return
  const openedIn = conversationIdFromPath(doc.location.pathname)
  const origin = doc.location.pathname + doc.location.search
  if (shouldPushEntry) history.pushState(null, '', LIBRARY_ADDRESS)
  const follow = followMain(state.runtime, main)
  const view: View = { follow, isPushed: shouldPushEntry, origin, openedIn, loads: 0, stops: [] }
  state.view = view
  store.libraryOver.value = shouldPushEntry ? openedIn : null
  store.pill.value = null
  store.popover.value = null
  view.stops.push(markOpen(doc), follow.stop, ...watchView(state, view))
  void loadSnapshot(state, view)
}

const launch = (state: HostState): void => {
  if (!state.isLaunching) return
  const isWanted = state.runtime.doc.location.hash === LIBRARY_HASH
  if (isWanted) openView(state, REUSE_ENTRY)
  state.isLaunching = isWanted && state.view === null
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

const followSettledPage = (state: HostState): void => {
  closeWhenAddressLeft(state)
  state.view?.follow.refresh()
  state.navEntry.keepShown()
  launch(state)
}

const watchHost = (state: HostState, open: () => void, afterSettle: AfterSettle): Stop => {
  const stops = [
    afterSettle(() => followSettledPage(state)),
    onTabCommand(open),
    listen(window, { type: 'popstate' }, () => followHistory(state)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
}

const toggleView = (state: HostState): void => {
  if (state.view) closeView(state, RESTORE_HISTORY)
  else openView(state, PUSH_ENTRY)
}

export const startLibraryHost = (runtime: Runtime, afterSettle: AfterSettle): LibraryHost => {
  const state: HostState = {
    runtime,
    view: null,
    navEntry: startNavEntry(runtime.doc, () => toggleView(state)),
    isLaunching: runtime.doc.location.hash === LIBRARY_HASH,
  }
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
      state.navEntry.stop()
    },
  }
}
