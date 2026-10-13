import type { CheckOutcome, Conversation, ConversationHighlights, Snapshot } from '@/model'
import { isPurgeable, transition } from '@/retention'
import { type Database, inTransaction, type Transaction } from './database'

export const ensureConversation = async (
  tx: Transaction,
  conversation: Conversation,
): Promise<void> => {
  const store = tx.objectStore('conversations')
  if ((await store.getKey(conversation.id)) === undefined) await store.add(conversation)
}

export const readSnapshotIn = async (
  tx: Transaction<'readonly' | 'readwrite'>,
): Promise<Snapshot> => {
  const [conversations, highlights] = await Promise.all([
    tx.objectStore('conversations').getAll(),
    tx.objectStore('highlights').getAll(),
  ])
  return { conversations, highlights }
}

export const deleteConversationIfEmpty = async (
  tx: Transaction,
  conversationId: string,
): Promise<void> => {
  const remaining = await tx.objectStore('highlights').index('conversationId').count(conversationId)
  if (remaining === 0) await tx.objectStore('conversations').delete(conversationId)
}

const removeConversation = async (tx: Transaction, conversationId: string): Promise<void> => {
  const highlights = tx.objectStore('highlights')
  const ids = await highlights.index('conversationId').getAllKeys(conversationId)
  await Promise.all([
    ...ids.map((id) => highlights.delete(id)),
    tx.objectStore('conversations').delete(conversationId),
  ])
}

export const loadConversation = (
  db: Database,
  conversationId: string,
): Promise<ConversationHighlights> =>
  inTransaction(db, 'readonly', async (tx) => {
    const [conversation, highlights] = await Promise.all([
      tx.objectStore('conversations').get(conversationId),
      tx.objectStore('highlights').index('conversationId').getAll(conversationId),
    ])
    return { conversation: conversation ?? null, highlights }
  })

export const readConversation = async (
  db: Database,
  conversationId: string,
): Promise<Conversation | null> => (await db.get('conversations', conversationId)) ?? null

export const listConversations = (db: Database): Promise<Conversation[]> =>
  inTransaction(db, 'readonly', (tx) => tx.objectStore('conversations').getAll())

export const readSnapshot = (db: Database): Promise<Snapshot> =>
  inTransaction(db, 'readonly', readSnapshotIn)

export const applyCheck = (
  db: Database,
  check: { conversationId: string; outcome: CheckOutcome },
  now: number,
): Promise<Conversation | null> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const store = tx.objectStore('conversations')
    const current = await store.get(check.conversationId)
    if (current === undefined) return null
    const next = transition(current, check.outcome, now)
    await store.put(next)
    return next
  })

export const purgeConversation = (db: Database, conversationId: string): Promise<void> =>
  inTransaction(db, 'readwrite', (tx) => removeConversation(tx, conversationId))

export const purgeExpired = (db: Database, now: number): Promise<string[]> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const trashed = await tx.objectStore('conversations').index('status').getAll('trashed')
    const expired = trashed.filter((conversation) => isPurgeable(conversation, now))
    const ids = expired.map(({ id }) => id)
    await Promise.all(ids.map((id) => removeConversation(tx, id)))
    return ids
  })
