import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames,
} from 'idb'
import { APP_SLUG, type Conversation, type ConversationStatus, type Highlight } from '@/model'

export const DATABASE_NAME = APP_SLUG
export const DATABASE_VERSION = 2
const STORE_NAMES = ['highlights', 'conversations'] as const

interface HighlightsSchema extends DBSchema {
  highlights: {
    key: string
    value: Highlight
    indexes: { conversationId: string }
  }
  conversations: {
    key: string
    value: Conversation
    indexes: { status: ConversationStatus; trashedAt: number }
  }
}

type AccessMode = 'readonly' | 'readwrite'

export type Database = IDBPDatabase<HighlightsSchema>
export type PendingDatabase = Promise<Database>
export type Transaction<Mode extends AccessMode = 'readwrite'> = IDBPTransaction<
  HighlightsSchema,
  typeof STORE_NAMES,
  Mode
>

type Migration = (
  db: Database,
  tx: IDBPTransaction<HighlightsSchema, StoreNames<HighlightsSchema>[], 'versionchange'>,
) => void

const MIGRATIONS: readonly Migration[] = [
  (db) => {
    db.createObjectStore('highlights', { keyPath: 'id' }).createIndex(
      'conversationId',
      'conversationId',
    )
    db.createObjectStore('conversations', { keyPath: 'id' }).createIndex('status', 'status')
  },
  (_db, tx) => {
    tx.objectStore('conversations').createIndex('trashedAt', 'trashedAt')
  },
]

export const openDatabase = (name: string = DATABASE_NAME): Promise<Database> =>
  openDB<HighlightsSchema>(name, DATABASE_VERSION, {
    upgrade: (db, oldVersion, ...[, tx]) => {
      for (const migrate of MIGRATIONS.slice(oldVersion)) migrate(db, tx)
    },
  })

export const inTransaction = async <Mode extends AccessMode, Value>(
  db: Database,
  mode: Mode,
  work: (tx: Transaction<Mode>) => Promise<Value>,
): Promise<Value> => {
  const tx = db.transaction(STORE_NAMES, mode)
  // Abort on error, unless a failed request already did
  const guarded = work(tx).catch((error: unknown) => {
    if (tx.error === null) tx.abort()
    throw error
  })
  const [result] = await Promise.all([guarded, tx.done])
  return result
}
