import type { HighlightColor } from './colors'

export interface Span {
  start: number
  end: number
}

export interface Quote extends Span {
  exact: string
  prefix: string
  suffix: string
}

export interface Highlight {
  id: string
  conversationId: string
  messageId: string
  quote: Quote
  color: HighlightColor
  note: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type ConversationStatus = 'active' | 'trashed'

export interface Conversation {
  id: string
  title: string
  status: ConversationStatus
  trashedAt: number | null
  checkedAt: number
  updatedAt: number
}

export interface NewHighlight {
  conversationId: string
  conversationTitle: string
  messageId: string
  quote: Quote
  color: HighlightColor
  note: string
}

export interface HighlightPatch {
  color?: HighlightColor
  note?: string
  tags?: string[]
}

export interface DeletedHighlight {
  highlight: Highlight
  conversation: Conversation
}

export interface ConversationHighlights {
  conversation: Conversation | null
  highlights: Highlight[]
}

export interface Snapshot {
  conversations: Conversation[]
  highlights: Highlight[]
}

export type CheckOutcome =
  | { kind: 'exists'; title: string }
  | { kind: 'missing' }
  | { kind: 'unknown' }

export interface ImportReport {
  added: number
  updated: number
  skipped: number
}
