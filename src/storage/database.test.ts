import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeConversation, makeHighlight } from '@/testing'
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  type Database,
  inTransaction,
  openDatabase,
} from './database'

let db: Database

beforeEach(async () => {
  db = await openDatabase(crypto.randomUUID())
})

describe('openDatabase', () => {
  it('names the database chatgpt-highlights by default', async () => {
    const named = await openDatabase()
    expect(named.name).toBe(DATABASE_NAME)
    expect(DATABASE_NAME).toBe('chatgpt-highlights')
    expect(DATABASE_VERSION).toBe(1)
  })

  it('creates version 1 with a highlights store and a conversations store', () => {
    expect(db.version).toBe(DATABASE_VERSION)
    expect([...db.objectStoreNames].toSorted()).toEqual(['conversations', 'highlights'])
  })

  it('indexes highlights by conversationId and conversations by status', async () => {
    const tx = db.transaction(['highlights', 'conversations'])
    expect([...tx.objectStore('highlights').indexNames]).toEqual(['conversationId'])
    expect([...tx.objectStore('conversations').indexNames]).toEqual(['status'])
    expect(tx.objectStore('highlights').keyPath).toBe('id')
    expect(tx.objectStore('conversations').keyPath).toBe('id')
    await tx.done
  })

  it('keeps stored rows when the database is opened again', async () => {
    const name = crypto.randomUUID()
    const first = await openDatabase(name)
    await first.put('conversations', makeConversation())
    first.close()
    const second = await openDatabase(name)
    expect(await second.get('conversations', makeConversation().id)).toEqual(makeConversation())
  })
})

describe('inTransaction', () => {
  it('returns what the work returns after the transaction commits', async () => {
    const result = await inTransaction(db, 'readwrite', async (tx) => {
      await tx.objectStore('highlights').add(makeHighlight())
      return 'done'
    })
    expect(result).toBe('done')
    expect(await db.count('highlights')).toBe(1)
  })

  it('rejects with the error the work throws', async () => {
    const failure = new Error('boom')
    await expect(
      inTransaction(db, 'readonly', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
  })

  it('rolls back every write when one request fails', async () => {
    await db.put('highlights', makeHighlight())
    const attempt = inTransaction(db, 'readwrite', async (tx) => {
      await tx.objectStore('conversations').put(makeConversation())
      await tx.objectStore('highlights').add(makeHighlight())
    })
    await expect(attempt).rejects.toThrow()
    expect(await db.count('conversations')).toBe(0)
  })

  it('rolls back the writes made before the work throws', async () => {
    const failure = new Error('boom')
    const attempt = inTransaction(db, 'readwrite', async (tx) => {
      await tx.objectStore('conversations').put(makeConversation())
      throw failure
    })
    await expect(attempt).rejects.toBe(failure)
    expect(await db.count('conversations')).toBe(0)
  })

  it('rolls back the writes made before a request call throws', async () => {
    const attempt = inTransaction(db, 'readwrite', async (tx) => {
      await tx.objectStore('conversations').put(makeConversation())
      await tx.objectStore('highlights').put(makeHighlight(), 'out-of-line-key')
    })
    await expect(attempt).rejects.toMatchObject({ name: 'DataError' })
    expect(await db.count('conversations')).toBe(0)
  })
})
