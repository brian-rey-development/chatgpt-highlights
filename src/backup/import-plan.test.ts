import { describe, expect, it } from 'vitest'
import type { Snapshot } from '@/model'
import { EMPTY_SNAPSHOT, FIXED_TIME, LATER_TIME, makeConversation, makeHighlight } from '@/testing'
import { type ImportPlan, planImport } from './import-plan'

const EARLIER = FIXED_TIME - 1000

const applyPlan = (existing: Snapshot, plan: ImportPlan): Snapshot => {
  const replace = <T extends { id: string }>(current: readonly T[], changed: readonly T[]): T[] => {
    const ids = new Set(changed.map(({ id }) => id))
    return [...current.filter(({ id }) => !ids.has(id)), ...changed]
  }
  return {
    conversations: replace(existing.conversations, plan.conversations),
    highlights: replace(existing.highlights, plan.highlights),
  }
}

describe('planImport', () => {
  it('adds everything into an empty library', () => {
    const incoming: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight(), makeHighlight({ id: 'highlight-2' })],
    }
    expect(planImport(EMPTY_SNAPSHOT, incoming)).toEqual({
      ...incoming,
      report: { added: 2, updated: 0, skipped: 0 },
    })
  })

  it('adds highlights with unknown ids next to the existing ones', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const fresh = makeHighlight({ id: 'highlight-2' })
    const plan = planImport(existing, {
      conversations: existing.conversations,
      highlights: [makeHighlight(), fresh],
    })
    expect(plan.highlights).toEqual([fresh])
    expect(plan.report).toEqual({ added: 1, updated: 0, skipped: 1 })
  })

  it('updates a highlight whose incoming copy is newer', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const newer = makeHighlight({ note: 'Edited elsewhere', updatedAt: LATER_TIME })
    const plan = planImport(existing, {
      conversations: existing.conversations,
      highlights: [newer],
    })
    expect(plan.highlights).toEqual([newer])
    expect(plan.report).toEqual({ added: 0, updated: 1, skipped: 0 })
  })

  it.each([
    { name: 'older', updatedAt: EARLIER },
    { name: 'equally old', updatedAt: FIXED_TIME },
  ])('skips a highlight whose incoming copy is $name', ({ updatedAt }) => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const stale = makeHighlight({ note: 'Stale', updatedAt })
    const plan = planImport(existing, {
      conversations: existing.conversations,
      highlights: [stale],
    })
    expect(plan.highlights).toEqual([])
    expect(plan.report).toEqual({ added: 0, updated: 0, skipped: 1 })
  })

  it('merges conversations by the same newer-wins rule', () => {
    const existing: Snapshot = {
      conversations: [
        makeConversation({ id: 'kept', title: 'Mine' }),
        makeConversation({ id: 'renamed', title: 'Old name' }),
      ],
      highlights: [],
    }
    const renamed = makeConversation({ id: 'renamed', title: 'New name', updatedAt: LATER_TIME })
    const stale = makeConversation({ id: 'kept', title: 'Theirs', updatedAt: EARLIER })
    const brandNew = makeConversation({ id: 'brand-new' })
    const filler = makeHighlight({ id: 'filler', conversationId: 'brand-new' })
    const plan = planImport(existing, {
      conversations: [renamed, stale, brandNew],
      highlights: [filler],
    })
    expect(plan.conversations).toEqual([renamed, brandNew])
  })

  it('keeps a highlight in its stored chat when a backup files it under another', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const incoming: Snapshot = {
      conversations: [makeConversation({ id: 'other' })],
      highlights: [makeHighlight({ conversationId: 'other', updatedAt: LATER_TIME })],
    }
    expect(planImport(existing, incoming)).toEqual({
      conversations: [],
      highlights: [],
      report: { added: 0, updated: 0, skipped: 1 },
    })
  })

  it('adds no chat whose highlights all live elsewhere', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const incoming: Snapshot = {
      conversations: [makeConversation({ id: 'other' })],
      highlights: [makeHighlight({ conversationId: 'other', updatedAt: EARLIER })],
    }
    expect(planImport(existing, incoming).conversations).toEqual([])
  })

  it('still adds a chat that receives at least one new highlight', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    const fresh = makeHighlight({ id: 'highlight-2', conversationId: 'other' })
    const incoming: Snapshot = {
      conversations: [makeConversation({ id: 'other' })],
      highlights: [makeHighlight({ conversationId: 'other' }), fresh],
    }
    const plan = planImport(existing, incoming)
    expect(plan.conversations).toEqual([makeConversation({ id: 'other' })])
    expect(plan.highlights).toEqual([fresh])
    expect(plan.report).toEqual({ added: 1, updated: 0, skipped: 1 })
  })

  it('counts highlights only in the report', () => {
    const incoming: Snapshot = { conversations: [makeConversation()], highlights: [] }
    expect(planImport(EMPTY_SNAPSHOT, incoming).report).toEqual({
      added: 0,
      updated: 0,
      skipped: 0,
    })
  })

  it('never writes the entities it leaves out of the file', () => {
    const existing: Snapshot = {
      conversations: [makeConversation()],
      highlights: [makeHighlight()],
    }
    expect(planImport(existing, EMPTY_SNAPSHOT)).toEqual({
      conversations: [],
      highlights: [],
      report: { added: 0, updated: 0, skipped: 0 },
    })
  })

  it('reports everything skipped when the same snapshot is planned after a first import', () => {
    const incoming: Snapshot = {
      conversations: [makeConversation(), makeConversation({ id: 'conversation-2' })],
      highlights: [
        makeHighlight(),
        makeHighlight({
          id: 'highlight-2',
          conversationId: 'conversation-2',
          updatedAt: LATER_TIME,
        }),
      ],
    }
    const existing: Snapshot = {
      conversations: [makeConversation({ updatedAt: EARLIER })],
      highlights: [
        makeHighlight({ id: 'highlight-2', conversationId: 'conversation-2', updatedAt: EARLIER }),
      ],
    }
    const first = planImport(existing, incoming)
    expect(first.report).toEqual({ added: 1, updated: 1, skipped: 0 })
    const second = planImport(applyPlan(existing, first), incoming)
    expect(second.report).toEqual({ added: 0, updated: 0, skipped: incoming.highlights.length })
    expect(second.conversations).toEqual([])
    expect(second.highlights).toEqual([])
  })
})
