import {
  type Conversation,
  DEFAULT_COLOR,
  type Highlight,
  type NewHighlight,
  type Quote,
} from '@/model'

export const FIXED_TIME = 1_700_000_000_000
export const LATER_TIME = FIXED_TIME + 1_000

export const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
  exact: 'highlighted text',
  prefix: 'before ',
  suffix: ' after',
  start: 7,
  end: 23,
  ...overrides,
})

export const makeHighlight = (overrides: Partial<Highlight> = {}): Highlight => ({
  id: 'highlight-1',
  conversationId: 'conversation-1',
  messageId: 'message-1',
  quote: makeQuote(),
  color: DEFAULT_COLOR,
  note: '',
  tags: [],
  createdAt: FIXED_TIME,
  updatedAt: FIXED_TIME,
  ...overrides,
})

export const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conversation-1',
  title: 'Conversation title',
  status: 'active',
  trashedAt: null,
  checkedAt: FIXED_TIME,
  updatedAt: FIXED_TIME,
  ...overrides,
})

export const makeNewHighlight = (overrides: Partial<NewHighlight> = {}): NewHighlight => ({
  conversationId: 'conversation-1',
  conversationTitle: 'Conversation title',
  messageId: 'message-1',
  quote: makeQuote(),
  color: DEFAULT_COLOR,
  note: '',
  ...overrides,
})
