import { describe, expect, it } from 'vitest'
import { type CheckOutcome, type Conversation, DAY_MS } from '@/model'
import { FIXED_TIME, makeConversation } from '@/testing'
import {
  CHECK_INTERVAL_MS,
  daysUntilPurge,
  isDue,
  isPurgeable,
  PURGE_AFTER_MS,
  transition,
} from './retention'

const NOW = FIXED_TIME + 10 * CHECK_INTERVAL_MS
const EARLIER_TRASH = FIXED_TIME - DAY_MS

const active = makeConversation({ title: 'Old title' })
const trashed = makeConversation({ status: 'trashed', trashedAt: EARLIER_TRASH })

const exists: CheckOutcome = { kind: 'exists', title: 'New title' }
const missing: CheckOutcome = { kind: 'missing' }
const unknown: CheckOutcome = { kind: 'unknown' }

interface Cell {
  name: string
  from: Conversation
  outcome: CheckOutcome
  expected: Conversation
}

const cells: Cell[] = [
  {
    name: 'active and exists stays active with the new title and check time',
    from: active,
    outcome: exists,
    expected: { ...active, title: 'New title', checkedAt: NOW, updatedAt: NOW },
  },
  {
    name: 'active and missing is trashed now',
    from: active,
    outcome: missing,
    expected: { ...active, status: 'trashed', trashedAt: NOW, checkedAt: NOW, updatedAt: NOW },
  },
  { name: 'active and unknown is unchanged', from: active, outcome: unknown, expected: active },
  {
    name: 'trashed and exists returns to active',
    from: trashed,
    outcome: exists,
    expected: {
      ...trashed,
      title: 'New title',
      status: 'active',
      trashedAt: null,
      checkedAt: NOW,
      updatedAt: NOW,
    },
  },
  {
    name: 'trashed and missing records the check without moving the trash time',
    from: trashed,
    outcome: missing,
    expected: { ...trashed, checkedAt: NOW },
  },
  {
    name: 'active and exists without a title keeps the stored title',
    from: active,
    outcome: { kind: 'exists', title: '' },
    expected: { ...active, checkedAt: NOW, updatedAt: NOW },
  },
  { name: 'trashed and unknown is unchanged', from: trashed, outcome: unknown, expected: trashed },
]

describe('transition', () => {
  it.each(cells)('$name', ({ from, outcome, expected }) => {
    expect(transition(from, outcome, NOW)).toEqual(expected)
  })

  it('keeps the original trashedAt of an already trashed conversation', () => {
    expect(transition(trashed, missing, NOW).trashedAt).toBe(EARLIER_TRASH)
  })

  it('does not mutate the conversation it was given', () => {
    const before = { ...active }
    transition(active, missing, NOW)
    expect(active).toEqual(before)
  })
})

describe('isDue', () => {
  it.each([
    { name: 'a check just made', age: 0, expected: false },
    { name: 'a check a millisecond short of an hour', age: CHECK_INTERVAL_MS - 1, expected: false },
    { name: 'a check exactly an hour old', age: CHECK_INTERVAL_MS, expected: true },
    { name: 'a check older than an hour', age: CHECK_INTERVAL_MS + 1, expected: true },
  ])('is $expected for $name', ({ age, expected }) => {
    const conversation = makeConversation({ checkedAt: NOW - age })
    expect(isDue(conversation, NOW)).toBe(expected)
  })
})

const trashedAgo = (age: number): Conversation =>
  makeConversation({ status: 'trashed', trashedAt: NOW - age })

describe('isPurgeable', () => {
  it.each([
    { name: 'a millisecond before 30 days', age: PURGE_AFTER_MS - 1, expected: false },
    { name: 'exactly 30 days', age: PURGE_AFTER_MS, expected: true },
    { name: 'past 30 days', age: PURGE_AFTER_MS + 1, expected: true },
  ])('is $expected $name after trashing', ({ age, expected }) => {
    expect(isPurgeable(trashedAgo(age), NOW)).toBe(expected)
  })

  it('is false for an active conversation', () => {
    expect(isPurgeable(makeConversation({ trashedAt: NOW - PURGE_AFTER_MS }), NOW)).toBe(false)
  })

  it('is false for a trashed conversation without a trash time', () => {
    expect(isPurgeable(makeConversation({ status: 'trashed' }), NOW)).toBe(false)
  })
})

describe('daysUntilPurge', () => {
  it.each([
    { name: 'just trashed', age: 0, expected: 30 },
    { name: 'a millisecond after trashing', age: 1, expected: 30 },
    { name: 'a day and a millisecond after trashing', age: DAY_MS + 1, expected: 29 },
    { name: 'exactly 29 days after trashing', age: 29 * DAY_MS, expected: 1 },
    { name: 'a millisecond before the purge', age: PURGE_AFTER_MS - 1, expected: 1 },
    { name: 'the purge moment', age: PURGE_AFTER_MS, expected: 0 },
    { name: 'long past the purge', age: 3 * PURGE_AFTER_MS, expected: 0 },
  ])('is $expected $name', ({ age, expected }) => {
    expect(daysUntilPurge(trashedAgo(age), NOW)).toBe(expected)
  })

  it('reports the full window for a conversation that is not trashed', () => {
    expect(daysUntilPurge(active, NOW)).toBe(30)
  })
})
