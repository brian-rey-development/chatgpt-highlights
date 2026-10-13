import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { DAY_MS, MINUTE_MS } from '@/model'
import { PURGE_AFTER_MS } from '@/retention'
import { type Database, openDatabase, readSnapshot } from '@/storage'
import {
  changedIn,
  FAKE_TAB_ID,
  FIXED_TIME,
  installFakeTabs,
  makeConversation,
  makeHighlight,
  type SentMessage,
} from '@/testing'
import { PURGE_ALARM, runPurge, startPurge } from './purge'

const EXPIRED_ID = 'conversation-expired'
const RECENT_ID = 'conversation-recent'
const AFTER_EXPIRY = FIXED_TIME + PURGE_AFTER_MS + 1
const DAILY_PERIOD_MINUTES = DAY_MS / MINUTE_MS

let db: Database
let sent: SentMessage[]

const trashed = (id: string, trashedAt: number) =>
  makeConversation({ id, status: 'trashed', trashedAt })

const seedExpired = async (): Promise<void> => {
  await db.put('conversations', trashed(EXPIRED_ID, FIXED_TIME))
  await db.put('highlights', makeHighlight({ id: 'highlight-expired', conversationId: EXPIRED_ID }))
}

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
  sent = installFakeTabs([{ id: FAKE_TAB_ID }])
  vi.spyOn(Date, 'now').mockReturnValue(AFTER_EXPIRY)
})

describe('runPurge', () => {
  it('removes conversations trashed 30 days ago with their highlights and names them', async () => {
    await seedExpired()
    await db.put('conversations', trashed(RECENT_ID, AFTER_EXPIRY))
    await runPurge(Promise.resolve(db))
    const snapshot = await readSnapshot(db)
    expect(snapshot.conversations.map(({ id }) => id)).toEqual([RECENT_ID])
    expect(snapshot.highlights).toEqual([])
    expect(sent).toEqual(changedIn(EXPIRED_ID))
  })

  it('broadcasts nothing when no conversation is due', async () => {
    await db.put('conversations', trashed(RECENT_ID, AFTER_EXPIRY))
    await runPurge(Promise.resolve(db))
    expect(sent).toEqual([])
  })
})

describe('startPurge', () => {
  it('purges once on startup', async () => {
    await seedExpired()
    await startPurge(Promise.resolve(db))
    expect((await readSnapshot(db)).conversations).toEqual([])
    expect(sent).toEqual(changedIn(EXPIRED_ID))
  })

  it('schedules a daily purge alarm', async () => {
    await startPurge(Promise.resolve(db))
    const alarm = await fakeBrowser.alarms.get(PURGE_ALARM)
    expect(alarm?.periodInMinutes).toBe(DAILY_PERIOD_MINUTES)
  })

  it('keeps an existing alarm so a restarting worker never postpones the daily tick', async () => {
    await fakeBrowser.alarms.create(PURGE_ALARM, { periodInMinutes: DAILY_PERIOD_MINUTES })
    const create = vi.spyOn(fakeBrowser.alarms, 'create')
    await startPurge(Promise.resolve(db))
    expect(create).not.toHaveBeenCalled()
  })

  it('purges when the purge alarm fires', async () => {
    await startPurge(Promise.resolve(db))
    await seedExpired()
    await fakeBrowser.alarms.onAlarm.trigger({
      name: PURGE_ALARM,
      scheduledTime: AFTER_EXPIRY,
      persistAcrossSessions: false,
    })
    expect((await readSnapshot(db)).conversations).toEqual([])
    expect(sent).toEqual(changedIn(EXPIRED_ID))
  })

  it('ignores other alarms', async () => {
    await startPurge(Promise.resolve(db))
    await seedExpired()
    await fakeBrowser.alarms.onAlarm.trigger({
      name: 'other',
      scheduledTime: AFTER_EXPIRY,
      persistAcrossSessions: false,
    })
    expect((await readSnapshot(db)).conversations).toHaveLength(1)
  })
})
