import { describe, expect, it } from 'vitest'
import type { Highlight, Snapshot } from '@/model'
import { EMPTY_SNAPSHOT, makeConversation, makeHighlight, makeQuote } from '@/testing'
import type { LibraryFilter } from '../types'
import { countRows, groupLibrary, type LibraryGroup, tagsInUse, takeRows } from './library-filter'

const ALL: LibraryFilter = { text: '', color: null, tag: null }

const highlightIn = (conversationId: string, id: string, extra: Partial<Highlight> = {}) =>
  makeHighlight({ id, conversationId, createdAt: 1000, ...extra })

const snapshotOf = (...parts: Partial<Snapshot>[]): Snapshot => ({
  conversations: parts.flatMap((part) => part.conversations ?? []),
  highlights: parts.flatMap((part) => part.highlights ?? []),
})

const idsOf = (groups: readonly LibraryGroup[]) =>
  groups.map((group) => [group.conversation.id, group.highlights.map((h) => h.id)])

describe('groupLibrary ordering', () => {
  const snapshot = snapshotOf({
    conversations: [
      makeConversation({ id: 'old', title: 'Old chat' }),
      makeConversation({ id: 'new', title: 'New chat' }),
    ],
    highlights: [
      highlightIn('old', 'old-1', { createdAt: 500 }),
      highlightIn('new', 'new-2', { createdAt: 3000 }),
      highlightIn('new', 'new-1', { createdAt: 2000 }),
    ],
  })

  it('orders active groups by their newest highlight, newest group first', () => {
    const { active } = groupLibrary(snapshot, ALL)
    expect(active.map((group) => group.conversation.id)).toEqual(['new', 'old'])
  })

  it('orders the highlights inside a group oldest first', () => {
    const { active } = groupLibrary(snapshot, ALL)
    expect(idsOf(active)).toEqual([
      ['new', ['new-1', 'new-2']],
      ['old', ['old-1']],
    ])
  })

  it('does not reorder the input snapshot', () => {
    const before = snapshot.highlights.map((h) => h.id)
    groupLibrary(snapshot, ALL)
    expect(snapshot.highlights.map((h) => h.id)).toEqual(before)
  })

  it('returns two empty sections for an empty snapshot', () => {
    expect(groupLibrary(EMPTY_SNAPSHOT, ALL)).toEqual({
      active: [],
      trashed: [],
    })
  })

  it('leaves out a chat that has no highlights', () => {
    const empty = snapshotOf({ conversations: [makeConversation({ id: 'bare' })] })
    expect(groupLibrary(empty, ALL)).toEqual({ active: [], trashed: [] })
  })

  it('leaves out highlights whose conversation is unknown', () => {
    const orphaned = snapshotOf({ highlights: [highlightIn('ghost', 'lost')] })
    expect(groupLibrary(orphaned, ALL)).toEqual({ active: [], trashed: [] })
  })
})

describe('groupLibrary trash', () => {
  const snapshot = snapshotOf({
    conversations: [
      makeConversation({ id: 'live' }),
      makeConversation({ id: 'gone', status: 'trashed', trashedAt: 5 }),
    ],
    highlights: [highlightIn('live', 'a'), highlightIn('gone', 'b')],
  })

  it('keeps trashed chats apart from active ones', () => {
    const { active, trashed } = groupLibrary(snapshot, ALL)
    expect(idsOf(active)).toEqual([['live', ['a']]])
    expect(idsOf(trashed)).toEqual([['gone', ['b']]])
  })

  it('applies the filter to the trashed chats too', () => {
    const { trashed } = groupLibrary(snapshot, { ...ALL, text: 'nothing matches this' })
    expect(trashed).toEqual([])
  })
})

describe('groupLibrary filtering', () => {
  const snapshot = snapshotOf({
    conversations: [
      makeConversation({ id: 'c1', title: 'Bayesian A/B tests' }),
      makeConversation({ id: 'c2', title: 'Eigenvectors' }),
    ],
    highlights: [
      highlightIn('c1', 'quote-hit', {
        quote: makeQuote({ exact: 'The Posterior is updated' }),
        color: 'yellow',
        tags: ['stats'],
      }),
      highlightIn('c1', 'note-hit', {
        note: 'Use a weakly informative PRIOR',
        color: 'green',
        tags: ['stats', 'ab'],
      }),
      highlightIn('c2', 'plain', { color: 'green', tags: ['math'] }),
    ],
  })
  const idsFor = (filter: Partial<LibraryFilter>) =>
    groupLibrary(snapshot, { ...ALL, ...filter }).active.flatMap((g) =>
      g.highlights.map((h) => h.id),
    )

  it.each([
    { name: 'quote', text: 'posterior', expected: ['quote-hit'] },
    { name: 'note', text: 'prior', expected: ['note-hit'] },
    {
      name: 'chat title, for every highlight in it',
      text: 'bayesian',
      expected: ['quote-hit', 'note-hit'],
    },
    { name: 'text in another case', text: 'EIGEN', expected: ['plain'] },
    { name: 'text with surrounding spaces', text: '  posterior ', expected: ['quote-hit'] },
  ])('matches the search text in the $name', ({ text, expected }) => {
    expect(idsFor({ text })).toEqual(expected)
  })

  it('filters by color', () => {
    expect(idsFor({ color: 'green' })).toEqual(['note-hit', 'plain'])
  })

  it('filters by tag', () => {
    expect(idsFor({ tag: 'ab' })).toEqual(['note-hit'])
  })

  it('combines search, color and tag', () => {
    expect(idsFor({ text: 'bayesian', color: 'green', tag: 'stats' })).toEqual(['note-hit'])
    expect(idsFor({ text: 'eigen', color: 'yellow' })).toEqual([])
  })

  it('drops groups with no matching highlight', () => {
    const { active } = groupLibrary(snapshot, { ...ALL, tag: 'math' })
    expect(active.map((group) => group.conversation.id)).toEqual(['c2'])
  })
})

describe('tagsInUse', () => {
  it('lists every tag once, sorted', () => {
    const snapshot = snapshotOf({
      highlights: [
        highlightIn('c', 'a', { tags: ['zeta', 'beta'] }),
        highlightIn('c', 'b', { tags: ['beta', 'alpha'] }),
      ],
    })
    expect(tagsInUse(snapshot)).toEqual(['alpha', 'beta', 'zeta'])
  })

  it('is empty when nothing is tagged', () => {
    expect(tagsInUse(snapshotOf({ highlights: [highlightIn('c', 'a')] }))).toEqual([])
  })
})

describe('row limits', () => {
  const group = (id: string, count: number): LibraryGroup => ({
    conversation: makeConversation({ id }),
    highlights: Array.from({ length: count }, (_, index) => highlightIn(id, `${id}-${index}`)),
  })
  const groups = [group('a', 3), group('b', 2)]

  it('counts rows across groups', () => {
    expect(countRows(groups)).toBe(5)
  })

  it('cuts inside a group when the limit falls there', () => {
    expect(idsOf(takeRows(groups, 4))).toEqual([
      ['a', ['a-0', 'a-1', 'a-2']],
      ['b', ['b-0']],
    ])
  })

  it('drops the groups past the limit', () => {
    expect(idsOf(takeRows(groups, 3))).toEqual([['a', ['a-0', 'a-1', 'a-2']]])
  })

  it('returns everything when the limit is generous', () => {
    expect(countRows(takeRows(groups, 200))).toBe(5)
  })
})

describe('groupLibrary at scale', () => {
  const CHATS = 300
  const PER_CHAT = 10
  const reads = { conversationId: 0, title: 0 }

  const counted = <T extends object, K extends keyof T>(
    target: T,
    key: K,
    counter: keyof typeof reads,
  ): T => {
    const value = target[key]
    return Object.defineProperty(target, key, {
      get: () => {
        reads[counter] += 1
        return value
      },
    })
  }

  const scaled = (): Snapshot => {
    const conversations = Array.from({ length: CHATS }, (_, chat) =>
      counted(makeConversation({ id: `chat-${chat}`, title: `Chat ${chat}` }), 'title', 'title'),
    )
    const highlights = conversations.flatMap(({ id }) =>
      Array.from({ length: PER_CHAT }, (_, index) =>
        counted(
          highlightIn(id, `${id}-${index}`, { note: `note ${index}` }),
          'conversationId',
          'conversationId',
        ),
      ),
    )
    return { conversations, highlights }
  }

  it('reads each highlight and each title once while filtering', () => {
    const snapshot = scaled()
    reads.conversationId = 0
    reads.title = 0
    groupLibrary(snapshot, { ...ALL, text: ' NOTE 7 ' })
    expect(reads.conversationId).toBe(CHATS * PER_CHAT)
    expect(reads.title).toBe(CHATS)
  })

  it('returns the matching row of every chat', () => {
    const { active } = groupLibrary(scaled(), { ...ALL, text: 'note 7' })
    expect(active).toHaveLength(CHATS)
    expect(active.flatMap((group) => group.highlights.map((h) => h.note))).toEqual(
      Array.from({ length: CHATS }, () => 'note 7'),
    )
  })

  it('matches every row of a chat through its title', () => {
    const { active } = groupLibrary(scaled(), { ...ALL, text: 'chat 42' })
    expect(active.map((group) => group.conversation.id)).toEqual(['chat-42'])
    expect(countRows(active)).toBe(PER_CHAT)
  })
})
