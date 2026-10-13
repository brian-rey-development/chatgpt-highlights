import { CENTERED_SCROLL, findUnit, scrollToMessage } from '@/chatgpt'
import { flash, type PaintTarget } from '@/painter'
import { clearJump, type Jump, loadJump } from './jump'
import type { Stop } from './listen'
import type { AfterSettle } from './session'
import type { Runtime } from './store'

export const REVEAL_TIMEOUT_MS = 10_000

export interface Reveal {
  track: (jump: Jump) => void
  stop: Stop
}

interface RevealState {
  runtime: Runtime
  jump: Jump | null
  scrolled: boolean
  timer: ReturnType<typeof setTimeout> | undefined
}

const finish = (state: RevealState): void => {
  clearTimeout(state.timer)
  state.timer = undefined
  state.jump = null
  clearJump()
}

const show = (state: RevealState, target: PaintTarget): void => {
  const { painter } = state.runtime
  target.range.startContainer.parentElement?.scrollIntoView(CENTERED_SCROLL)
  flash(painter, target.id)
  finish(state)
}

const bringIntoView = (state: RevealState, jump: Jump): void => {
  const { doc, store } = state.runtime
  const highlight = store.highlights.value.get(jump.highlightId)
  if (!highlight || state.scrolled || findUnit(doc, highlight.messageId)) return
  state.scrolled = true
  scrollToMessage(doc, highlight.messageId)
}

const step = (state: RevealState, jump: Jump): void => {
  const { store, painter } = state.runtime
  if (store.conversationId.value !== jump.conversationId) return
  const target = painter.painted.get(jump.highlightId)
  if (target) show(state, target)
  else bringIntoView(state, jump)
}

const track = (state: RevealState, jump: Jump): void => {
  clearTimeout(state.timer)
  state.jump = jump
  state.scrolled = false
  state.timer = setTimeout(() => finish(state), REVEAL_TIMEOUT_MS)
  step(state, jump)
}

export const startReveal = (runtime: Runtime, afterSettle: AfterSettle): Reveal => {
  const state: RevealState = { runtime, jump: null, scrolled: false, timer: undefined }
  const stopHook = afterSettle(() => {
    if (state.jump) step(state, state.jump)
  })
  const stored = loadJump()
  if (stored) track(state, stored)
  return {
    track: (jump) => track(state, jump),
    stop: () => {
      stopHook()
      clearTimeout(state.timer)
    },
  }
}
