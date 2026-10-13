import { planImport, serializeBackup } from '@/backup'
import type { ImportReport, Snapshot } from '@/model'
import { readSnapshot, readSnapshotIn } from './conversations'
import { type Database, inTransaction } from './database'

export const exportBackup = async (db: Database, now: number): Promise<string> =>
  serializeBackup(await readSnapshot(db), now)

export const importBackup = (db: Database, incoming: Snapshot): Promise<ImportReport> =>
  inTransaction(db, 'readwrite', async (tx) => {
    const plan = planImport(await readSnapshotIn(tx), incoming)
    const conversations = tx.objectStore('conversations')
    const highlights = tx.objectStore('highlights')
    await Promise.all([
      ...plan.conversations.map((conversation) => conversations.put(conversation)),
      ...plan.highlights.map((highlight) => highlights.put(highlight)),
    ])
    return plan.report
  })
