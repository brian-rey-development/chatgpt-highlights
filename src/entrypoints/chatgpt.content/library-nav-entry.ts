import { ensureSidebarItem, isItemShown } from '@/chatgpt'
import type { Stop } from './listen'

export interface NavEntry {
  contains: (target: Element) => boolean
  keepShown: () => void
  stop: Stop
}

interface EntryState {
  doc: Document
  onClick: () => void
  entry: HTMLElement | null
  frame: number | null
  observer: ResizeObserver
}

const keepShown = (state: EntryState): void => {
  if (isItemShown(state.entry)) return
  if (state.entry) state.observer.unobserve(state.entry)
  state.entry = ensureSidebarItem(state.doc, state.onClick)
  if (state.entry) state.observer.observe(state.entry)
}

const keepShownNextFrame = (state: EntryState): void => {
  if (state.frame !== null) return
  state.frame = requestAnimationFrame(() => {
    state.frame = null
    keepShown(state)
  })
}

const stopEntry = (state: EntryState): void => {
  state.observer.disconnect()
  if (state.frame !== null) cancelAnimationFrame(state.frame)
  state.entry?.remove()
  state.entry = null
}

export const startNavEntry = (doc: Document, onClick: () => void): NavEntry => {
  const state: EntryState = {
    doc,
    onClick,
    entry: null,
    frame: null,
    observer: new ResizeObserver(() => keepShownNextFrame(state)),
  }
  return {
    contains: (target) => state.entry?.contains(target) === true,
    keepShown: () => keepShown(state),
    stop: () => stopEntry(state),
  }
}
