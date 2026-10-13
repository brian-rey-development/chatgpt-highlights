import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_COLOR } from '@/model'
import {
  FIXED_TIME,
  LATER_TIME,
  makeConversation,
  makeHighlight,
  makeNewHighlight,
  makeQuote,
} from '@/testing'
import { type Database, openDatabase } from './database'
import { createHighlight, deleteHighlight, restoreHighlight, updateHighlight } from './highlights'

let db: Database

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
})

describe('createHighlight', () => {
  it('stores a highlight with a fresh id, no tags and the clock on both timestamps', async () => {
    const highlight = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    expect(highlight).toEqual({
      id: highlight.id,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      quote: makeQuote(),
      color: DEFAULT_COLOR,
      note: '',
      tags: [],
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    })
    expect(highlight.id).not.toBe('')
    expect(await db.get('highlights', highlight.id)).toEqual(highlight)
  })

  it('gives every highlight its own id', async () => {
    const first = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const second = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    expect(second.id).not.toBe(first.id)
  })

  it('creates the conversation row with its title for the first highlight', async () => {
    await createHighlight(db, makeNewHighlight({ conversationTitle: 'Plan the trip' }), FIXED_TIME)
    expect(await db.getAll('conversations')).toEqual([
      makeConversation({ title: 'Plan the trip', checkedAt: FIXED_TIME, updatedAt: FIXED_TIME }),
    ])
  })

  it('returns a trashed chat to active when a highlight is created in it', async () => {
    await db.put('conversations', makeConversation({ status: 'trashed', trashedAt: FIXED_TIME }))
    await createHighlight(db, makeNewHighlight(), LATER_TIME)
    expect(await db.get('conversations', 'conversation-1')).toMatchObject({
      status: 'active',
      trashedAt: null,
      checkedAt: LATER_TIME,
      title: 'Conversation title',
    })
  })

  it('reuses the conversation row for later highlights', async () => {
    await createHighlight(db, makeNewHighlight({ conversationTitle: 'First title' }), FIXED_TIME)
    await createHighlight(db, makeNewHighlight({ conversationTitle: 'Other title' }), LATER_TIME)
    expect(await db.getAll('conversations')).toEqual([
      makeConversation({ title: 'First title', checkedAt: FIXED_TIME, updatedAt: FIXED_TIME }),
    ])
    expect(await db.count('highlights')).toBe(2)
  })

  it('gives different conversations their own rows', async () => {
    await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight({ conversationId: 'conversation-2' }), FIXED_TIME)
    expect(await db.count('conversations')).toBe(2)
  })
})

describe('updateHighlight', () => {
  it('merges the patch and bumps updatedAt', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const updated = await updateHighlight(
      db,
      { id: created.id, patch: { note: 'Edited', tags: ['idea'] } },
      LATER_TIME,
    )
    expect(updated).toEqual({ ...created, note: 'Edited', tags: ['idea'], updatedAt: LATER_TIME })
    expect(await db.get('highlights', created.id)).toEqual(updated)
  })

  it('keeps the fields the patch leaves out', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const updated = await updateHighlight(
      db,
      { id: created.id, patch: { color: 'pink' } },
      LATER_TIME,
    )
    expect(updated).toEqual({ ...created, color: 'pink', updatedAt: LATER_TIME })
  })

  it('throws not_found for an unknown id and writes nothing', async () => {
    await expect(
      updateHighlight(db, { id: 'ghost', patch: { note: 'x' } }, LATER_TIME),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect(await db.count('highlights')).toBe(0)
  })
})

describe('deleteHighlight', () => {
  it('returns the deleted highlight with its conversation', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const other = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await deleteHighlight(db, created.id)
    expect(deleted).toEqual({
      highlight: created,
      conversation: makeConversation({ checkedAt: FIXED_TIME }),
    })
    expect(await db.getAllKeys('highlights')).toEqual([other.id])
  })

  it('keeps the conversation row while other highlights remain', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await deleteHighlight(db, created.id)
    expect(await db.count('conversations')).toBe(1)
  })

  it('deletes the conversation row with the last highlight', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight({ conversationId: 'conversation-2' }), FIXED_TIME)
    await deleteHighlight(db, created.id)
    expect(await db.getAllKeys('conversations')).toEqual(['conversation-2'])
  })

  it('throws not_found for an unknown id', async () => {
    await expect(deleteHighlight(db, 'ghost')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('throws not_found and keeps the highlight when its conversation row is missing', async () => {
    await db.put('highlights', makeHighlight())
    await expect(deleteHighlight(db, 'highlight-1')).rejects.toMatchObject({ code: 'not_found' })
    expect(await db.count('highlights')).toBe(1)
  })
})

describe('restoreHighlight', () => {
  it('recreates the highlight and its conversation after the last one was deleted', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await deleteHighlight(db, created.id)
    expect(await restoreHighlight(db, deleted)).toEqual(created)
    expect(await db.get('highlights', created.id)).toEqual(created)
    expect(await db.get('conversations', deleted.conversation.id)).toEqual(deleted.conversation)
  })

  it('keeps the current conversation row when it still exists', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await deleteHighlight(db, created.id)
    const renamed = makeConversation({ title: 'Renamed since', updatedAt: LATER_TIME })
    await db.put('conversations', renamed)
    await restoreHighlight(db, deleted)
    expect(await db.get('conversations', renamed.id)).toEqual(renamed)
  })

  it('leaves a highlight that came back another way where it is', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await deleteHighlight(db, created.id)
    const elsewhere = makeConversation({ id: 'conversation-elsewhere' })
    const returned = { ...created, conversationId: elsewhere.id }
    await db.put('conversations', elsewhere)
    await db.put('highlights', returned)
    expect(await restoreHighlight(db, deleted)).toEqual(returned)
    expect(await db.getAll('conversations')).toEqual([elsewhere])
  })

  it('is safe to apply twice', async () => {
    const created = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await deleteHighlight(db, created.id)
    await restoreHighlight(db, deleted)
    await restoreHighlight(db, deleted)
    expect(await db.count('highlights')).toBe(1)
    expect(await db.count('conversations')).toBe(1)
  })
})
