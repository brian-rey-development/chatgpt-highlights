import type {
  CheckOutcome,
  Conversation,
  ConversationHighlights,
  DeletedHighlight,
  Highlight,
  HighlightPatch,
  ImportReport,
  NewHighlight,
  Snapshot,
} from '@/model'

export type Request =
  | { type: 'conversation.load'; conversationId: string }
  | { type: 'conversations.list' }
  | { type: 'conversation.check'; conversationId: string; outcome: CheckOutcome }
  | { type: 'conversation.purge'; conversationId: string }
  | { type: 'highlight.create'; input: NewHighlight }
  | { type: 'highlight.update'; id: string; patch: HighlightPatch }
  | { type: 'highlight.delete'; id: string }
  | { type: 'highlight.restore'; deleted: DeletedHighlight }
  | { type: 'library.snapshot' }
  | { type: 'backup.export' }
  | { type: 'backup.import'; text: string }

export interface Responses {
  'conversation.load': ConversationHighlights
  'conversations.list': Conversation[]
  'conversation.check': Conversation | null
  'conversation.purge': null
  'highlight.create': Highlight
  'highlight.update': Highlight
  'highlight.delete': DeletedHighlight | null
  'highlight.restore': Highlight
  'library.snapshot': Snapshot
  'backup.export': string
  'backup.import': ImportReport
}

export type RequestType = Request['type']
export type RequestOf<T extends RequestType> = Extract<Request, { type: T }>
export type Handlers = { [T in RequestType]: (request: RequestOf<T>) => Promise<Responses[T]> }

export type AppEvent = { type: 'data.changed'; conversationIds: readonly string[] }
export type TabCommand = { type: 'library.open' }
