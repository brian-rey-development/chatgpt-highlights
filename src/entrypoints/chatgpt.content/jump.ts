import { APP_SLUG, fieldOf } from '@/model'

export interface Jump {
  conversationId: string
  highlightId: string
}

export const JUMP_STORAGE_KEY = `${APP_SLUG}:jump`

const bestEffort = <Result>(action: () => Result, fallback: Result): Result => {
  try {
    return action()
  } catch {
    return fallback
  }
}

export const saveJump = (jump: Jump): void => {
  bestEffort(() => sessionStorage.setItem(JUMP_STORAGE_KEY, JSON.stringify(jump)), undefined)
}

export const clearJump = (): void => {
  bestEffort(() => sessionStorage.removeItem(JUMP_STORAGE_KEY), undefined)
}

export const loadJump = (): Jump | null => {
  const raw = bestEffort(() => sessionStorage.getItem(JUMP_STORAGE_KEY), null)
  if (raw === null) return null
  const value = bestEffort<unknown>(() => JSON.parse(raw), undefined)
  const conversationId = fieldOf(value, 'conversationId')
  const highlightId = fieldOf(value, 'highlightId')
  if (typeof conversationId !== 'string' || typeof highlightId !== 'string') return null
  return { conversationId, highlightId }
}
