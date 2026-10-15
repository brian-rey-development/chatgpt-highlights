import { checkConversation, fetchSession, type Session } from '@/chatgpt'
import { request } from '@/messaging'
import { type Conversation, MOVED_TO_TRASH_MESSAGE } from '@/model'
import { isDue } from '@/retention'
import type { Stop } from './listen'
import { type Runtime, showMessage } from './store'

export const MAX_IN_FLIGHT = 4
export const PASS_TIMEOUT_MS = 120_000

interface StatusCheckState {
  runtime: Runtime
  isStopped: boolean
  wasOpen: boolean
  isRunning: boolean
  generation: number
}

const check = async (session: Session, conversation: Conversation): Promise<boolean> => {
  const outcome = await checkConversation(session, conversation.id)
  if (outcome.kind === 'unknown') return false
  const result = await request({
    type: 'conversation.check',
    conversationId: conversation.id,
    outcome,
  })
  return conversation.status === 'active' && result.ok && result.data?.status === 'trashed'
}

const checkAll = async (
  state: StatusCheckState,
  session: Session,
  due: readonly Conversation[],
): Promise<boolean[]> => {
  const queue = [...due]
  const moved: boolean[] = []
  const work = async (): Promise<void> => {
    for (let next = queue.shift(); next && !state.isStopped; next = queue.shift()) {
      moved.push(await check(session, next))
    }
  }
  await Promise.all(Array.from({ length: MAX_IN_FLIGHT }, work))
  return moved
}

const dueConversations = async (): Promise<Conversation[]> => {
  const listed = await request({ type: 'conversations.list' })
  if (!listed.ok) return []
  const now = Date.now()
  return listed.data.filter((conversation) => isDue(conversation, now))
}

const runPass = async (state: StatusCheckState): Promise<void> => {
  const due = await dueConversations()
  if (due.length === 0 || state.isStopped) return
  const session = await fetchSession()
  if (!session || state.isStopped) return
  const moved = await checkAll(state, session, due)
  if (moved.includes(true) && !state.isStopped) {
    showMessage(state.runtime.store, MOVED_TO_TRASH_MESSAGE)
  }
}

const startPass = (state: StatusCheckState): void => {
  state.generation += 1
  const generation = state.generation
  const release = (): void => {
    if (state.generation === generation) state.isRunning = false
  }
  state.isRunning = true
  const watchdog = setTimeout(release, PASS_TIMEOUT_MS)
  void runPass(state).finally(() => {
    clearTimeout(watchdog)
    release()
  })
}

export const startStatusChecks = (runtime: Runtime): Stop => {
  const state: StatusCheckState = {
    runtime,
    isStopped: false,
    wasOpen: false,
    isRunning: false,
    generation: 0,
  }
  const stopWatching = runtime.store.library.subscribe((library) => {
    const isOpen = library !== null
    if (isOpen && !state.wasOpen && !state.isRunning) startPass(state)
    state.wasOpen = isOpen
  })
  return () => {
    state.isStopped = true
    stopWatching()
  }
}
