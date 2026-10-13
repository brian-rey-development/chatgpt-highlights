import { AppFailure } from '@/errors'
import type {
  Conversation,
  DeletedHighlight,
  Highlight,
  HighlightPatch,
  NewHighlight,
} from '@/model'
import { transition } from '@/retention'
import { deleteConversationIfEmpty, ensureConversation } from './conversations'
import { type Database, inTransaction, type Transaction } from './database'

const requireRow = <Row>(row: Row | undefined, description: string): Row => {
  if (row === undefined) throw new AppFailure('not_found', `${description} was not found`)
  return row
}

const conversationFor = (input: NewHighlight, now: number): Conversation => ({
  id: input.conversationId,
  title: input.conversationTitle,
  status: 'active',
  trashedAt: null,
  checkedAt: now,
  updatedAt: now,
})

const highlightFor = ({ conversationTitle, ...fields }: NewHighlight, now: number): Highlight => ({
  id: crypto.randomUUID(),
  ...fields,
  tags: [],
  createdAt: now,
  updatedAt: now,
})

const settleConversation = async (
  tx: Transaction,
  input: NewHighlight,
  now: number,
): Promise<void> => {
  const store = tx.objectStore('conversations')
  const current = await store.get(input.conversationId)
  if (current === undefined) await store.add(conversationFor(input, now))
  else if (current.status === 'trashed') {
    await store.put(transition(current, { kind: 'exists', title: input.conversationTitle }, now))
  }
}

export const createHighlight = (
  db: Database,
  input: NewHighlight,
  now: number,
): Promise<Highlight> => {
  const highlight = highlightFor(input, now)
  return inTransaction(db, 'readwrite', async (tx) => {
    await settleConversation(tx, input, now)
    await tx.objectStore('highlights').add(highlight)
    return highlight
  })
}

export const updateHighlight = (
  db: Database,
  change: { id: string; patch: HighlightPatch },
  now: number,
): Promise<Highlight> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const store = tx.objectStore('highlights')
    const current = requireRow(await store.get(change.id), `Highlight ${change.id}`)
    const updated: Highlight = { ...current, ...change.patch, updatedAt: now }
    await store.put(updated)
    return updated
  })

export const deleteHighlight = (db: Database, id: string): Promise<DeletedHighlight> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const highlights = tx.objectStore('highlights')
    const highlight = requireRow(await highlights.get(id), `Highlight ${id}`)
    const { conversationId } = highlight
    const conversation = requireRow(
      await tx.objectStore('conversations').get(conversationId),
      `Conversation ${conversationId}`,
    )
    await highlights.delete(id)
    await deleteConversationIfEmpty(tx, conversationId)
    return { highlight, conversation }
  })

export const restoreHighlight = (db: Database, deleted: DeletedHighlight): Promise<Highlight> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const current = await tx.objectStore('highlights').get(deleted.highlight.id)
    if (current !== undefined) return current
    await ensureConversation(tx, deleted.conversation)
    await tx.objectStore('highlights').add(deleted.highlight)
    return deleted.highlight
  })
