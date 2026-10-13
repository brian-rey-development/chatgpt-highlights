import type { Snapshot } from '@/model'
import type { Database } from '@/storage'

export const seedDatabase = async (
  db: Database,
  { conversations, highlights }: Snapshot,
): Promise<void> => {
  await Promise.all([
    ...conversations.map((conversation) => db.put('conversations', conversation)),
    ...highlights.map((highlight) => db.put('highlights', highlight)),
  ])
}
