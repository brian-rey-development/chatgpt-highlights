import { z } from 'zod'
import { AppFailure } from '@/errors'
import type { Snapshot } from '@/model'
import { conversationSchema, describeIssues, highlightSchema, timestampSchema } from '@/schemas'

export const BACKUP_FORMAT = 'chatgpt-highlights'
export const BACKUP_VERSION = 1

const INDENT = 2

const backupSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: timestampSchema,
  conversations: z.array(conversationSchema),
  highlights: z.array(highlightSchema),
})

const invalid = (reason: string): AppFailure =>
  new AppFailure('invalid_backup', `This is not a valid backup file: ${reason}`)

export const serializeBackup = (snapshot: Snapshot, now: number): string =>
  JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      conversations: snapshot.conversations,
      highlights: snapshot.highlights,
    },
    null,
    INDENT,
  )

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    throw invalid('the text is not valid JSON')
  }
}

const duplicateId = (entities: readonly { id: string }[]): string | null => {
  const seen = new Set<string>()
  for (const { id } of entities) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}

const assertConsistent = ({ conversations, highlights }: Snapshot): void => {
  const repeated = duplicateId(conversations) ?? duplicateId(highlights)
  if (repeated !== null) throw invalid(`the id ${repeated} appears twice`)
  const known = new Set(conversations.map(({ id }) => id))
  const orphan = highlights.find(({ conversationId }) => !known.has(conversationId))
  if (orphan)
    throw invalid(`highlight ${orphan.id} belongs to unknown chat ${orphan.conversationId}`)
  const used = new Set(highlights.map(({ conversationId }) => conversationId))
  const empty = conversations.find(({ id }) => !used.has(id))
  if (empty) throw invalid(`chat ${empty.id} has no highlights`)
}

export const parseBackup = (text: string): Snapshot => {
  const parsed = backupSchema.safeParse(parseJson(text))
  if (!parsed.success) throw invalid(describeIssues(parsed.error))
  const { conversations, highlights } = parsed.data
  assertConsistent({ conversations, highlights })
  return { conversations, highlights }
}
