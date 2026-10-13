import { checkConversation, fetchSession, type Session } from '@/chatgpt'
import { request } from '@/messaging'
import { type Conversation, MOVED_TO_TRASH_MESSAGE } from '@/model'
import { isDue } from '@/retention'
import type { Stop } from './listen'
import { type Runtime, showMessage } from './store'

export const MAX_IN_FLIGHT = 4

interface StatusCheckState {
  runtime: Runtime
  stopped: boolean
  wasOpen: boolean
  running: boolean
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
    for (let next = queue.shift(); next && !state.stopped; next = queue.shift()) {
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
  if (due.length === 0 || state.stopped) return
  const session = await fetchSession()
  if (!session || state.stopped) return
  const moved = await checkAll(state, session, due)
  if (moved.includes(true) && !state.stopped) {
    showMessage(state.runtime.store, MOVED_TO_TRASH_MESSAGE)
  }
}

const startPass = (state: StatusCheckState): void => {
  state.running = true
  void runPass(state).finally(() => {
    state.running = false
  })
}

export const startStatusChecks = (runtime: Runtime): Stop => {
  const state: StatusCheckState = { runtime, stopped: false, wasOpen: false, running: false }
  const stopWatching = runtime.store.library.subscribe((library) => {
    const isOpen = library !== null
    if (isOpen && !state.wasOpen && !state.running) startPass(state)
    state.wasOpen = isOpen
  })
  return () => {
    state.stopped = true
    stopWatching()
  }
}
