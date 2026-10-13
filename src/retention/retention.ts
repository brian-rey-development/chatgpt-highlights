import { type CheckOutcome, type Conversation, DAY_MS, HOUR_MS } from '@/model'

const PURGE_AFTER_DAYS = 30

export const CHECK_INTERVAL_MS = HOUR_MS
export const PURGE_AFTER_MS = PURGE_AFTER_DAYS * DAY_MS

export const isDue = (conversation: Conversation, now: number): boolean =>
  now - conversation.checkedAt >= CHECK_INTERVAL_MS

const trash = (conversation: Conversation, now: number): Conversation => ({
  ...conversation,
  status: 'trashed',
  trashedAt: now,
  checkedAt: now,
  updatedAt: now,
})

const reactivate = (conversation: Conversation, title: string, now: number): Conversation => ({
  ...conversation,
  title: title === '' ? conversation.title : title,
  status: 'active',
  trashedAt: null,
  checkedAt: now,
  updatedAt: now,
})

export const transition = (
  conversation: Conversation,
  outcome: CheckOutcome,
  now: number,
): Conversation => {
  if (outcome.kind === 'exists') return reactivate(conversation, outcome.title, now)
  if (outcome.kind !== 'missing') return conversation
  return conversation.status === 'active'
    ? trash(conversation, now)
    : { ...conversation, checkedAt: now }
}

const purgeAt = (conversation: Conversation): number | null =>
  conversation.status === 'trashed' && conversation.trashedAt !== null
    ? conversation.trashedAt + PURGE_AFTER_MS
    : null

export const isPurgeable = (conversation: Conversation, now: number): boolean => {
  const at = purgeAt(conversation)
  return at !== null && now >= at
}

export const daysUntilPurge = (conversation: Conversation, now: number): number => {
  const at = purgeAt(conversation) ?? now + PURGE_AFTER_MS
  return Math.max(0, Math.ceil((at - now) / DAY_MS))
}
