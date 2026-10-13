import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import * as backup from '@/backup'
import { type CheckOutcome, fieldOf, type Snapshot } from '@/model'
import {
  createHighlight,
  type Database,
  loadConversation,
  openDatabase,
  readSnapshot,
} from '@/storage'
import {
  changedIn,
  FAKE_TAB_ID,
  FIXED_TIME,
  installFakeTabs,
  LATER_TIME,
  makeConversation,
  makeHighlight,
  makeNewHighlight,
  type SentMessage,
  seedDatabase,
} from '@/testing'
import { createHandlers } from './handlers'

const OTHER_ID = 'conversation-2'
const EXISTS: CheckOutcome = { kind: 'exists', title: 'Conversation title' }
const MISSING: CheckOutcome = { kind: 'missing' }
const UNKNOWN: CheckOutcome = { kind: 'unknown' }

let db: Database
let sent: SentMessage[]
let handlers: ReturnType<typeof createHandlers>

const nextMacrotask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const announcements = async (): Promise<SentMessage[]> => {
  await nextMacrotask()
  return sent
}

const clearAnnouncements = async (): Promise<void> => {
  await announcements()
  sent.length = 0
}

const backupOf = (snapshot: Snapshot): string => backup.serializeBackup(snapshot, FIXED_TIME)

const otherSnapshot: Snapshot = {
  conversations: [makeConversation({ id: OTHER_ID })],
  highlights: [makeHighlight({ id: 'highlight-9', conversationId: OTHER_ID })],
}

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
  sent = installFakeTabs([{ id: FAKE_TAB_ID }])
  vi.spyOn(Date, 'now').mockReturnValue(LATER_TIME)
  handlers = createHandlers(Promise.resolve(db))
})

describe('read handlers', () => {
  beforeEach(() =>
    seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] }),
  )

  it('conversation.load answers the conversation with its highlights', async () => {
    const loaded = await handlers['conversation.load']({
      type: 'conversation.load',
      conversationId: makeConversation().id,
    })
    expect(loaded).toEqual({ conversation: makeConversation(), highlights: [makeHighlight()] })
  })

  it('conversations.list answers every conversation', async () => {
    expect(await handlers['conversations.list']({ type: 'conversations.list' })).toEqual([
      makeConversation(),
    ])
  })

  it('library.snapshot answers the whole library', async () => {
    expect(await handlers['library.snapshot']({ type: 'library.snapshot' })).toEqual({
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    })
  })

  it('backup.export serializes the library at the current time', async () => {
    const text = await handlers['backup.export']({ type: 'backup.export' })
    const exported: unknown = JSON.parse(text)
    expect(fieldOf(exported, 'exportedAt')).toBe(LATER_TIME)
    expect(backup.parseBackup(text)).toEqual(await readSnapshot(db))
  })

  it('broadcasts nothing', async () => {
    await handlers['library.snapshot']({ type: 'library.snapshot' })
    await handlers['conversations.list']({ type: 'conversations.list' })
    expect(await announcements()).toEqual([])
  })
})

describe('highlight writes', () => {
  it('highlight.create stores the highlight now and names its conversation', async () => {
    const input = makeNewHighlight()
    const created = await handlers['highlight.create']({ type: 'highlight.create', input })
    expect(created.createdAt).toBe(LATER_TIME)
    expect((await loadConversation(db, input.conversationId)).highlights).toEqual([created])
    expect(await announcements()).toEqual(changedIn(input.conversationId))
  })

  it('highlight.update patches the highlight now and names its conversation', async () => {
    const stored = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const patch = { note: 'revisit' }
    const updated = await handlers['highlight.update']({
      type: 'highlight.update',
      id: stored.id,
      patch,
    })
    expect(updated).toEqual({ ...stored, ...patch, updatedAt: LATER_TIME })
    expect(await announcements()).toEqual(changedIn(stored.conversationId))
  })

  it('highlight.update of an unknown highlight fails and broadcasts nothing', async () => {
    const update = handlers['highlight.update']({
      type: 'highlight.update',
      id: 'missing',
      patch: { note: 'x' },
    })
    await expect(update).rejects.toMatchObject({ code: 'not_found' })
    expect(await announcements()).toEqual([])
  })

  it('highlight.delete removes the highlight and names its conversation', async () => {
    const stored = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await handlers['highlight.delete']({ type: 'highlight.delete', id: stored.id })
    expect(deleted.highlight).toEqual(stored)
    expect((await readSnapshot(db)).highlights).toEqual([])
    expect(await announcements()).toEqual(changedIn(stored.conversationId))
  })

  it('highlight.restore brings a deleted highlight back and names its conversation', async () => {
    const stored = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    const deleted = await handlers['highlight.delete']({ type: 'highlight.delete', id: stored.id })
    await clearAnnouncements()
    const restored = await handlers['highlight.restore']({ type: 'highlight.restore', deleted })
    expect(restored).toEqual(stored)
    expect((await readSnapshot(db)).highlights).toEqual([stored])
    expect(await announcements()).toEqual(changedIn(stored.conversationId))
  })
})

describe('announcing a write', () => {
  const createOne = () =>
    handlers['highlight.create']({ type: 'highlight.create', input: makeNewHighlight() })

  it('answers a write before the tabs have taken data.changed', async () => {
    const neverTaken = Promise.withResolvers<void>().promise
    vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(() => neverTaken)
    const created = await createOne()
    expect(created.createdAt).toBe(LATER_TIME)
  })

  it('answers a stored write even when the tabs cannot be listed', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValue(new Error('tabs gone'))
    const created = await createOne()
    expect((await readSnapshot(db)).highlights).toEqual([created])
  })
})

describe('conversation.purge', () => {
  it('removes the conversation with its highlights and names it', async () => {
    await seedDatabase(db, {
      conversations: [makeConversation(), makeConversation({ id: OTHER_ID })],
      highlights: [makeHighlight()],
    })
    const purged = await handlers['conversation.purge']({
      type: 'conversation.purge',
      conversationId: makeConversation().id,
    })
    expect(purged).toBeNull()
    expect(await readSnapshot(db)).toEqual({
      conversations: [makeConversation({ id: OTHER_ID })],
      highlights: [],
    })
    expect(await announcements()).toEqual(changedIn(makeConversation().id))
  })
})

describe('backup.import', () => {
  const importOf = (snapshot: Snapshot) =>
    handlers['backup.import']({ type: 'backup.import', text: backupOf(snapshot) })

  it('stores the backup and names every conversation it wrote', async () => {
    const snapshot: Snapshot = {
      conversations: [...otherSnapshot.conversations, makeConversation()],
      highlights: [...otherSnapshot.highlights, makeHighlight()],
    }
    const report = await importOf(snapshot)
    expect(report).toEqual({ added: 2, updated: 0, skipped: 0 })
    expect(await announcements()).toEqual(changedIn(OTHER_ID, makeConversation().id))
  })

  it('imports the same backup twice without duplicates, skipping it the second time', async () => {
    await importOf(otherSnapshot)
    const report = await importOf(otherSnapshot)
    expect(report).toEqual({ added: 0, updated: 0, skipped: 1 })
    expect(await readSnapshot(db)).toEqual(otherSnapshot)
  })

  it('names a conversation whose only change is newer metadata', async () => {
    await importOf(otherSnapshot)
    await clearAnnouncements()
    const renamed = makeConversation({ id: OTHER_ID, title: 'Renamed', updatedAt: LATER_TIME })
    await importOf({ ...otherSnapshot, conversations: [renamed] })
    expect(await readSnapshot(db)).toEqual({ ...otherSnapshot, conversations: [renamed] })
    expect(await announcements()).toEqual(changedIn(OTHER_ID))
  })

  it('parses the backup once', async () => {
    const parse = vi.spyOn(backup, 'parseBackup')
    await importOf(otherSnapshot)
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('rejects text that is not a backup and broadcasts nothing', async () => {
    const attempt = handlers['backup.import']({ type: 'backup.import', text: 'not json' })
    await expect(attempt).rejects.toMatchObject({ code: 'invalid_backup' })
    expect(await announcements()).toEqual([])
  })
})

describe('conversation.check', () => {
  const check = (outcome: CheckOutcome, conversationId = makeConversation().id) =>
    handlers['conversation.check']({ type: 'conversation.check', conversationId, outcome })

  beforeEach(() =>
    seedDatabase(db, { conversations: [makeConversation()], highlights: [makeHighlight()] }),
  )

  it('trashes a missing active conversation now and names it', async () => {
    const trashed = await check(MISSING)
    expect(trashed).toMatchObject({ status: 'trashed', trashedAt: LATER_TIME })
    expect(await announcements()).toEqual(changedIn(makeConversation().id))
  })

  it('returns a trashed conversation to active when it exists again and names it', async () => {
    await check(MISSING)
    await clearAnnouncements()
    const restored = await check({ kind: 'exists', title: 'Renamed' })
    expect(restored).toMatchObject({ status: 'active', trashedAt: null, title: 'Renamed' })
    expect(await announcements()).toEqual(changedIn(makeConversation().id))
  })

  it('stores a check that only refreshed its timestamps but broadcasts nothing', async () => {
    const refreshed = await check(EXISTS)
    expect(refreshed).toEqual({
      ...makeConversation(),
      checkedAt: LATER_TIME,
      updatedAt: LATER_TIME,
    })
    expect(await announcements()).toEqual([])
  })

  it('names a conversation whose title changed on an exists answer', async () => {
    await check({ kind: 'exists', title: 'Renamed' })
    expect(await announcements()).toEqual(changedIn(makeConversation().id))
  })

  it('leaves a conversation as it was and broadcasts nothing on an unknown answer', async () => {
    const answer = await check(UNKNOWN)
    expect(answer).toEqual(makeConversation())
    expect(await announcements()).toEqual([])
  })

  it('decides from the conversation row alone', async () => {
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction')
    await check(MISSING)
    const scopes = transaction.mock.calls.filter(([, mode]) => mode === 'readonly')
    expect(scopes.flatMap(([stores]) => [stores].flat())).not.toContain('highlights')
  })

  it('answers null and broadcasts nothing for a conversation that is not stored', async () => {
    expect(await check(MISSING, 'unstored')).toBeNull()
    expect(await announcements()).toEqual([])
  })
})
