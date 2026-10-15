import { parseBackup } from '@/backup'
import type { Handlers, RequestOf, RequestType } from '@/messaging'
import type { Conversation, Highlight } from '@/model'
import {
  applyCheck,
  createHighlight,
  type Database,
  deleteHighlight,
  exportBackup,
  importBackup,
  listConversations,
  loadConversation,
  type PendingDatabase,
  purgeConversation,
  readConversation,
  readSnapshot,
  restoreHighlight,
  updateHighlight,
} from '@/storage'
import { announceChange } from './announce'

type Operation<Result> = (db: Database) => Promise<Result>
type Group<Keys extends RequestType> = Pick<Handlers, Keys>

const hasChangedStanding = (before: Conversation | null, after: Conversation): boolean =>
  before === null ||
  before.title !== after.title ||
  before.status !== after.status ||
  before.trashedAt !== after.trashedAt

const touchedBy = ({ conversationId }: Highlight): string[] => [conversationId]

const noop = (): void => undefined

let writeQueue: Promise<void> = Promise.resolve()

const exclusive = <Result>(task: () => Promise<Result>): Promise<Result> => {
  const run = writeQueue.then(task)
  writeQueue = run.then(noop, noop)
  return run
}

const write = async <Result>(
  database: PendingDatabase,
  operation: Operation<Result>,
  touched: (result: Result) => string[],
): Promise<Result> => {
  const result = await exclusive(async () => operation(await database))
  // Do not wait: a slow tab must not delay the answer
  void announceChange(touched(result))
  return result
}

const checkStanding = async (
  database: PendingDatabase,
  check: RequestOf<'conversation.check'>,
): Promise<Conversation | null> => {
  const db = await database
  const before = await readConversation(db, check.conversationId)
  const after = await applyCheck(db, check, Date.now())
  if (after !== null && hasChangedStanding(before, after)) void announceChange([after.id])
  return after
}

const applyStatusCheck = (
  database: PendingDatabase,
  check: RequestOf<'conversation.check'>,
): Promise<Conversation | null> => exclusive(() => checkStanding(database, check))

const readHandlers = (
  database: PendingDatabase,
): Group<'conversation.load' | 'conversations.list' | 'library.snapshot' | 'backup.export'> => ({
  'conversation.load': async ({ conversationId }) =>
    loadConversation(await database, conversationId),
  'conversations.list': async () => listConversations(await database),
  'library.snapshot': async () => readSnapshot(await database),
  'backup.export': async () => exportBackup(await database, Date.now()),
})

const highlightHandlers = (
  database: PendingDatabase,
): Group<'highlight.create' | 'highlight.update' | 'highlight.restore' | 'highlight.delete'> => ({
  'highlight.create': ({ input }) =>
    write(database, (db) => createHighlight(db, input, Date.now()), touchedBy),
  'highlight.update': ({ id, patch }) =>
    write(database, (db) => updateHighlight(db, { id, patch }, Date.now()), touchedBy),
  'highlight.restore': ({ deleted }) =>
    write(database, (db) => restoreHighlight(db, deleted), touchedBy),
  'highlight.delete': ({ id }) =>
    write(
      database,
      (db) => deleteHighlight(db, id),
      (deleted) => (deleted ? touchedBy(deleted.highlight) : []),
    ),
})

const conversationHandlers = (
  database: PendingDatabase,
): Group<'conversation.check' | 'conversation.purge' | 'backup.import'> => ({
  'conversation.check': (check) => applyStatusCheck(database, check),
  'conversation.purge': ({ conversationId }) =>
    write(
      database,
      async (db) => {
        await purgeConversation(db, conversationId)
        return null
      },
      () => [conversationId],
    ),
  'backup.import': async ({ text }) => {
    const backup = parseBackup(text)
    return write(
      database,
      (db) => importBackup(db, backup),
      () => backup.conversations.map(({ id }) => id),
    )
  },
})

export const createHandlers = (database: PendingDatabase): Handlers => ({
  ...readHandlers(database),
  ...highlightHandlers(database),
  ...conversationHandlers(database),
})
