import { INERT_ATTR, LIBRARY_HASH, mainPane } from '@/chatgpt'
import type { Stop } from './listen'
import type { Runtime } from './store'

export interface MainFollow {
  refresh: () => void
  stop: Stop
}

interface Held {
  main: HTMLElement
  wasInert: boolean
}

interface FollowState {
  runtime: Runtime
  held: Held
  observer: ResizeObserver
}

const hold = (main: HTMLElement): Held => {
  const wasInert = main.hasAttribute(INERT_ATTR)
  main.toggleAttribute(INERT_ATTR, true)
  return { main, wasInert }
}

const release = ({ main, wasInert }: Held): void => {
  if (!wasInert) main.removeAttribute(INERT_ATTR)
}

const moveTo = (state: FollowState, main: HTMLElement): void => {
  state.observer.unobserve(state.held.main)
  release(state.held)
  state.held = hold(main)
  state.observer.observe(main)
}

// Once the hash is gone the view is closing
const shouldMoveTo = ({ runtime, held }: FollowState, main: HTMLElement): boolean =>
  main !== held.main && runtime.doc.location.hash === LIBRARY_HASH

const refresh = (state: FollowState): void => {
  const { doc, store } = state.runtime
  const main = mainPane(doc)
  if (main && shouldMoveTo(state, main)) moveTo(state, main)
  store.libraryFrame.value = state.held.main.getBoundingClientRect()
}

export const followMain = (runtime: Runtime, first: HTMLElement): MainFollow => {
  const state: FollowState = {
    runtime,
    held: hold(first),
    observer: new ResizeObserver(() => refresh(state)),
  }
  state.observer.observe(first)
  refresh(state)
  return {
    refresh: () => refresh(state),
    stop: () => {
      state.observer.disconnect()
      release(state.held)
    },
  }
}
