import 'fake-indexeddb/auto'
import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseBackup } from '@/backup'
import { type DeletedHighlight, HIGHLIGHT_COLORS, type Snapshot } from '@/model'
import { PURGE_AFTER_MS } from '@/retention'
import {
  FIXED_TIME,
  LATER_TIME,
  makeConversation,
  makeHighlight,
  makeNewHighlight,
} from '@/testing'
import { exportBackup, importBackup } from './backups'
import { applyCheck, purgeConversation, purgeExpired, readSnapshot } from './conversations'
import { type Database, openDatabase } from './database'
import { createHighlight, deleteHighlight, restoreHighlight, updateHighlight } from './highlights'

const PROPERTY_RUNS = 40
const CONVERSATION_POOL = 3
const MAX_UPDATED_AT = 50

const snapshot: Snapshot = {
  conversations: [
    makeConversation(),
    makeConversation({ id: 'conversation-2', status: 'trashed', trashedAt: FIXED_TIME }),
  ],
  highlights: [
    makeHighlight({ tags: ['one', 'two'], note: 'A note' }),
    makeHighlight({ id: 'highlight-2' }),
    makeHighlight({ id: 'highlight-3', conversationId: 'conversation-2', color: 'purple' }),
  ],
}

const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id)

const sorted = ({ conversations, highlights }: Snapshot): Snapshot => ({
  conversations: conversations.toSorted(byId),
  highlights: highlights.toSorted(byId),
})

const importSnapshot = (target: Database, value: Snapshot) => importBackup(target, value)

let db: Database

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
})

describe('exportBackup', () => {
  it('writes the whole library as a backup file', async () => {
    await importSnapshot(db, snapshot)
    expect(parseBackup(await exportBackup(db, LATER_TIME))).toEqual(sorted(snapshot))
    expect(JSON.parse(await exportBackup(db, LATER_TIME))).toMatchObject({ exportedAt: LATER_TIME })
  })

  it('writes a valid empty backup for an empty library', async () => {
    expect(parseBackup(await exportBackup(db, FIXED_TIME))).toEqual({
      conversations: [],
      highlights: [],
    })
  })
})

describe('importBackup', () => {
  it('into an empty database reproduces the snapshot', async () => {
    const report = await importSnapshot(db, snapshot)
    expect(report).toEqual({ added: 3, updated: 0, skipped: 0 })
    expect(await readSnapshot(db)).toEqual(sorted(snapshot))
  })

  it('reports everything skipped and changes nothing when imported a second time', async () => {
    await importSnapshot(db, snapshot)
    const report = await importSnapshot(db, snapshot)
    expect(report).toEqual({ added: 0, updated: 0, skipped: 3 })
    expect(await readSnapshot(db)).toEqual(sorted(snapshot))
  })

  it('updates the highlights whose incoming copy is newer', async () => {
    await importSnapshot(db, snapshot)
    const newer = makeHighlight({ note: 'Edited elsewhere', updatedAt: LATER_TIME })
    const incoming: Snapshot = { conversations: [makeConversation()], highlights: [newer] }
    expect(await importSnapshot(db, incoming)).toEqual({ added: 0, updated: 1, skipped: 0 })
    expect(await db.get('highlights', newer.id)).toEqual(newer)
  })

  it('keeps the highlights that are newer than the file', async () => {
    const current = makeHighlight({ note: 'Edited here', updatedAt: LATER_TIME })
    await importSnapshot(db, { conversations: [makeConversation()], highlights: [current] })
    const stale = { conversations: [makeConversation()], highlights: [makeHighlight()] }
    expect(await importSnapshot(db, stale)).toEqual({ added: 0, updated: 0, skipped: 1 })
    expect(await db.get('highlights', current.id)).toEqual(current)
  })

  it('adds the file next to what the library already holds', async () => {
    const other: Snapshot = {
      conversations: [makeConversation({ id: 'other' })],
      highlights: [makeHighlight({ id: 'other-highlight', conversationId: 'other' })],
    }
    await importSnapshot(db, snapshot)
    await importSnapshot(db, other)
    expect(await db.count('highlights')).toBe(snapshot.highlights.length + 1)
    expect(await db.count('conversations')).toBe(snapshot.conversations.length + 1)
  })

  it('reproduces a library built by the storage functions in an empty database', async () => {
    const first = await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight(), FIXED_TIME)
    await createHighlight(db, makeNewHighlight({ conversationId: 'conversation-2' }), FIXED_TIME)
    await updateHighlight(db, { id: first.id, patch: { tags: ['idea'] } }, LATER_TIME)
    await applyCheck(
      db,
      { conversationId: 'conversation-2', outcome: { kind: 'missing' } },
      LATER_TIME,
    )
    const empty = await openDatabase(crypto.randomUUID())
    const report = await importBackup(empty, parseBackup(await exportBackup(db, LATER_TIME)))
    expect(report).toEqual({ added: 3, updated: 0, skipped: 0 })
    expect(await readSnapshot(empty)).toEqual(await readSnapshot(db))
  })
})

interface Run {
  db: Database
  now: number
  deleted: DeletedHighlight[]
}

type Step = (run: Run) => Promise<unknown>

const chatId = (index: number): string => `conversation-${index}`

const chat = fc.nat(CONVERSATION_POOL - 1)
const color = fc.constantFrom(...HIGHLIGHT_COLORS)

const deleteAny =
  (pick: number): Step =>
  async (run) => {
    const { highlights } = await readSnapshot(run.db)
    const target = highlights[pick % Math.max(highlights.length, 1)]
    if (!target) return
    const deleted = await deleteHighlight(run.db, target.id)
    if (deleted) run.deleted.push(deleted)
  }

const restoreLast: Step = async (run) => {
  const last = run.deleted.at(-1)
  if (last) await restoreHighlight(run.db, last)
}

const checkChat =
  (index: number, found: boolean): Step =>
  (run) =>
    applyCheck(
      run.db,
      {
        conversationId: chatId(index),
        outcome: found ? { kind: 'exists', title: 'Found' } : { kind: 'missing' },
      },
      run.now,
    )

const snapshotArbitrary: fc.Arbitrary<Snapshot> = fc
  .array(
    fc.record({
      chat,
      color,
      note: fc.string({ maxLength: 20 }),
      updatedAt: fc.nat({ max: MAX_UPDATED_AT }),
    }),
    { maxLength: 8 },
  )
  .map((rows) => {
    const highlights = rows.map((row, index) =>
      makeHighlight({
        id: `highlight-${index}`,
        conversationId: chatId(row.chat),
        color: row.color,
        note: row.note,
        updatedAt: row.updatedAt,
      }),
    )
    const ids = new Set(highlights.map(({ conversationId }) => conversationId))
    return { conversations: [...ids].map((id) => makeConversation({ id })), highlights }
  })

const stepArbitrary: fc.Arbitrary<Step> = fc.oneof(
  fc.tuple(chat, color).map(
    ([index, picked]): Step =>
      (run) =>
        createHighlight(
          run.db,
          makeNewHighlight({ conversationId: chatId(index), color: picked }),
          run.now,
        ),
  ),
  fc.nat().map(deleteAny),
  fc.constant(restoreLast),
  chat.map(
    (index): Step =>
      (run) =>
        purgeConversation(run.db, chatId(index)),
  ),
  fc.tuple(chat, fc.boolean()).map(([index, found]) => checkChat(index, found)),
  fc.constant<Step>((run) => purgeExpired(run.db, run.now + PURGE_AFTER_MS)),
  snapshotArbitrary.map(
    (random): Step =>
      (run) =>
        importSnapshot(run.db, random),
  ),
)

describe('exportBackup over random libraries', () => {
  it('passes parseBackup after any sequence of storage operations', async () => {
    const steps = fc.array(stepArbitrary, { maxLength: 25 })
    await fc.assert(
      fc.asyncProperty(steps, async (sequence) => {
        const target = await openDatabase(crypto.randomUUID())
        const deleted: DeletedHighlight[] = []
        for (const [index, step] of sequence.entries())
          await step({ db: target, now: FIXED_TIME + index, deleted })
        const text = await exportBackup(target, FIXED_TIME)
        expect(() => parseBackup(text)).not.toThrow()
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })

  it('reproduces any valid snapshot after an import', async () => {
    await fc.assert(
      fc.asyncProperty(snapshotArbitrary, async (random) => {
        const target = await openDatabase(crypto.randomUUID())
        await importSnapshot(target, random)
        expect(parseBackup(await exportBackup(target, FIXED_TIME))).toEqual(sorted(random))
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })
})
