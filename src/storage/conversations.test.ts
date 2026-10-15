import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckOutcome, Conversation } from '@/model'
import { PURGE_AFTER_MS, transition } from '@/retention'
import {
  EMPTY_LOAD,
  FIXED_TIME,
  LATER_TIME,
  makeConversation,
  makeHighlight,
  seedDatabase,
} from '@/testing'
import {
  applyCheck,
  listConversations,
  loadConversation,
  purgeConversation,
  purgeExpired,
  readConversation,
  readSnapshot,
} from './conversations'
import { type Database, openDatabase } from './database'

const MISSING: CheckOutcome = { kind: 'missing' }

const trashedAt = (id: string, at: number): Conversation =>
  makeConversation({ id, status: 'trashed', trashedAt: at })

let db: Database

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
})

describe('loadConversation', () => {
  it('returns the conversation with only its own highlights', async () => {
    const own = [makeHighlight(), makeHighlight({ id: 'highlight-2' })]
    const foreign = makeHighlight({ id: 'highlight-3', conversationId: 'conversation-2' })
    await seedDatabase(db, {
      conversations: [makeConversation(), makeConversation({ id: 'conversation-2' })],
      highlights: [...own, foreign],
    })
    const loaded = await loadConversation(db, 'conversation-1')
    expect(loaded.conversation).toEqual(makeConversation())
    expect(loaded.highlights).toEqual(own)
  })

  it('returns no conversation and no highlights for an unknown id', async () => {
    await seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] })
    expect(await loadConversation(db, 'ghost')).toEqual(EMPTY_LOAD)
  })
})

describe('readConversation', () => {
  it('returns the conversation row without reading its highlights', async () => {
    await seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] })
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction')
    expect(await readConversation(db, 'conversation-1')).toEqual(makeConversation())
    expect(transaction.mock.calls).toEqual([['conversations', 'readonly']])
  })

  it('answers null for an unknown conversation', async () => {
    expect(await readConversation(db, 'ghost')).toBeNull()
  })
})

describe('listConversations', () => {
  it('returns every conversation, trashed ones included', async () => {
    const conversations = [makeConversation(), trashedAt('conversation-2', FIXED_TIME)]
    await seedDatabase(db, { conversations, highlights: [] })
    expect(await listConversations(db)).toEqual(conversations)
  })

  it('returns an empty list for an empty database', async () => {
    expect(await listConversations(db)).toEqual([])
  })
})

describe('readSnapshot', () => {
  it('returns every conversation and every highlight', async () => {
    const snapshot = {
      conversations: [makeConversation(), makeConversation({ id: 'conversation-2' })],
      highlights: [
        makeHighlight(),
        makeHighlight({ id: 'highlight-2', conversationId: 'conversation-2' }),
      ],
    }
    await seedDatabase(db, snapshot)
    expect(await readSnapshot(db)).toEqual(snapshot)
  })
})

describe('applyCheck', () => {
  it.each([
    { name: 'a missing chat is trashed', outcome: MISSING },
    { name: 'a found chat keeps its place', outcome: { kind: 'exists', title: 'Renamed' } },
    { name: 'an unknown answer changes nothing', outcome: { kind: 'unknown' } },
  ] satisfies { name: string; outcome: CheckOutcome }[])(
    'writes and returns the retention result when $name',
    async ({ outcome }) => {
      await seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] })
      const expected = transition(makeConversation(), outcome, LATER_TIME)
      const result = await applyCheck(db, { conversationId: 'conversation-1', outcome }, LATER_TIME)
      expect(result).toEqual(expected)
      expect(await db.get('conversations', 'conversation-1')).toEqual(expected)
    },
  )

  it('returns a trashed chat to active when it exists again', async () => {
    await seedDatabase(db, {
      conversations: [trashedAt('conversation-1', FIXED_TIME)],
      highlights: [makeHighlight()],
    })
    const outcome: CheckOutcome = { kind: 'exists', title: 'Back again' }
    const result = await applyCheck(db, { conversationId: 'conversation-1', outcome }, LATER_TIME)
    expect(result).toMatchObject({ status: 'active', trashedAt: null, title: 'Back again' })
  })

  it('returns null for an unknown id and writes nothing', async () => {
    const result = await applyCheck(db, { conversationId: 'ghost', outcome: MISSING }, LATER_TIME)
    expect(result).toBeNull()
    expect(await db.count('conversations')).toBe(0)
  })
})

describe('purgeConversation', () => {
  it('removes the conversation and its highlights and leaves the others', async () => {
    const kept = makeHighlight({ id: 'highlight-3', conversationId: 'conversation-2' })
    await seedDatabase(db, {
      conversations: [makeConversation(), makeConversation({ id: 'conversation-2' })],
      highlights: [makeHighlight(), makeHighlight({ id: 'highlight-2' }), kept],
    })
    await purgeConversation(db, 'conversation-1')
    expect(await db.getAllKeys('conversations')).toEqual(['conversation-2'])
    expect(await db.getAll('highlights')).toEqual([kept])
  })

  it('does nothing for an unknown id', async () => {
    await seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] })
    await purgeConversation(db, 'ghost')
    expect(await db.count('conversations')).toBe(1)
    expect(await db.count('highlights')).toBe(1)
  })
})

describe('purgeExpired', () => {
  const now = FIXED_TIME + PURGE_AFTER_MS

  it('removes only the purgeable conversations and returns their ids', async () => {
    await seedDatabase(db, {
      conversations: [
        makeConversation({ id: 'active' }),
        trashedAt('expired', FIXED_TIME),
        trashedAt('recent', FIXED_TIME + 1),
      ],
      highlights: [
        makeHighlight({ id: 'h-active', conversationId: 'active' }),
        makeHighlight({ id: 'h-expired', conversationId: 'expired' }),
        makeHighlight({ id: 'h-recent', conversationId: 'recent' }),
      ],
    })
    expect(await purgeExpired(db, now)).toEqual(['expired'])
    expect(await db.getAllKeys('conversations')).toEqual(['active', 'recent'])
    expect(await db.getAllKeys('highlights')).toEqual(['h-active', 'h-recent'])
  })

  it('purges a chat at the retention boundary and keeps one a millisecond short', async () => {
    await seedDatabase(db, {
      conversations: [trashedAt('edge', FIXED_TIME), trashedAt('short', FIXED_TIME + 1)],
      highlights: [
        makeHighlight({ id: 'h-edge', conversationId: 'edge' }),
        makeHighlight({ id: 'h-short', conversationId: 'short' }),
      ],
    })
    expect(await purgeExpired(db, now)).toEqual(['edge'])
  })

  it('keeps an active chat even when it still carries an old trash time', async () => {
    await seedDatabase(db, {
      conversations: [makeConversation({ status: 'active', trashedAt: FIXED_TIME })],
      highlights: [makeHighlight()],
    })
    expect(await purgeExpired(db, now)).toEqual([])
    expect(await db.count('conversations')).toBe(1)
  })

  it('returns an empty list and removes nothing when nothing expired', async () => {
    await seedDatabase(db, {
      conversations: [trashedAt('recent', FIXED_TIME + 1)],
      highlights: [makeHighlight({ conversationId: 'recent' })],
    })
    expect(await purgeExpired(db, now)).toEqual([])
    expect(await db.count('highlights')).toBe(1)
  })

  it('removes every expired conversation in one call', async () => {
    await seedDatabase(db, {
      conversations: [trashedAt('one', FIXED_TIME), trashedAt('two', FIXED_TIME - 1)],
      highlights: [
        makeHighlight({ id: 'h-one', conversationId: 'one' }),
        makeHighlight({ id: 'h-two', conversationId: 'two' }),
      ],
    })
    expect((await purgeExpired(db, now)).toSorted()).toEqual(['one', 'two'])
    expect(await db.count('conversations')).toBe(0)
    expect(await db.count('highlights')).toBe(0)
  })
})
