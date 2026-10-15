import { describe, expect, it, vi } from 'vitest'
import { LIMITS, type Snapshot } from '@/model'
import { MAX_DATE_MS } from '@/schemas'
import { EMPTY_SNAPSHOT, FIXED_TIME, makeConversation, makeHighlight } from '@/testing'
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, serializeBackup } from './backup-file'

const snapshot: Snapshot = {
  conversations: [
    makeConversation(),
    makeConversation({ id: 'conversation-2', status: 'trashed', trashedAt: FIXED_TIME }),
  ],
  highlights: [
    makeHighlight({ tags: ['one', 'two'], note: 'A note' }),
    makeHighlight({ id: 'highlight-2', conversationId: 'conversation-2', color: 'purple' }),
  ],
}

const fileWith = (changes: Record<string, unknown>): string =>
  JSON.stringify({ ...JSON.parse(serializeBackup(snapshot, FIXED_TIME)), ...changes })

const invalidBackup = (message: string | RegExp = '') =>
  expect.objectContaining({ code: 'invalid_backup', message: expect.stringMatching(message) })

describe('serializeBackup', () => {
  it('writes the format, the version, the export time and both collections', () => {
    expect(JSON.parse(serializeBackup(snapshot, FIXED_TIME))).toEqual({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: FIXED_TIME,
      ...snapshot,
    })
  })
})

describe('parseBackup', () => {
  it('round-trips a snapshot', () => {
    expect(parseBackup(serializeBackup(snapshot, FIXED_TIME))).toEqual(snapshot)
  })

  it('round-trips an empty snapshot', () => {
    expect(parseBackup(serializeBackup(EMPTY_SNAPSHOT, FIXED_TIME))).toEqual(EMPTY_SNAPSHOT)
  })

  it.each([
    { name: 'malformed JSON', text: '{"format": ' },
    { name: 'an empty string', text: '' },
    { name: 'a JSON array', text: '[]' },
    { name: 'another format', text: fileWith({ format: 'something-else' }) },
    { name: 'a future version', text: fileWith({ version: BACKUP_VERSION + 1 }) },
    { name: 'a missing export time', text: fileWith({ exportedAt: undefined }) },
    { name: 'an extra top-level key', text: fileWith({ extra: true }) },
    { name: 'a bad highlight', text: fileWith({ highlights: [{ id: 'x' }] }) },
    { name: 'a bad conversation', text: fileWith({ conversations: [{ id: 'x' }] }) },
    {
      name: 'a highlight with a bad color',
      text: fileWith({ highlights: [{ ...makeHighlight(), color: 'red' }] }),
    },
  ])('throws invalid_backup for $name', ({ text }) => {
    expect(() => parseBackup(text)).toThrow(invalidBackup())
  })

  it('throws invalid_backup for a duplicate highlight id', () => {
    const highlights = [makeHighlight(), makeHighlight()]
    expect(() => parseBackup(fileWith({ highlights }))).toThrow(invalidBackup('highlight-1'))
  })

  it('throws invalid_backup for a duplicate conversation id', () => {
    const conversations = [makeConversation(), makeConversation()]
    expect(() => parseBackup(fileWith({ conversations }))).toThrow(invalidBackup('conversation-1'))
  })

  it('throws invalid_backup for a highlight whose conversation is missing', () => {
    const highlights = [makeHighlight({ conversationId: 'ghost' })]
    expect(() => parseBackup(fileWith({ highlights }))).toThrow(invalidBackup('ghost'))
  })

  it('throws invalid_backup for a chat with no highlights', () => {
    const conversations = [...snapshot.conversations, makeConversation({ id: 'empty' })]
    expect(() => parseBackup(fileWith({ conversations }))).toThrow(invalidBackup('empty'))
  })

  it('throws invalid_backup for a trashed chat without a trash time', () => {
    const conversations = [makeConversation({ status: 'trashed' })]
    const text = fileWith({ conversations, highlights: [makeHighlight()] })
    expect(() => parseBackup(text)).toThrow(invalidBackup())
  })

  it('throws invalid_backup for an export time past the date range', () => {
    expect(() => parseBackup(fileWith({ exportedAt: MAX_DATE_MS + 1 }))).toThrow(invalidBackup())
  })

  it('throws invalid_backup for a file larger than the size cap without parsing it', () => {
    const spy = vi.spyOn(JSON, 'parse')
    expect(() => parseBackup('x'.repeat(LIMITS.backupChars + 1))).toThrow(
      invalidBackup(/too large/),
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'conversations', cap: LIMITS.backupConversations },
    { name: 'highlights', cap: LIMITS.backupHighlights },
  ])('throws invalid_backup for more than $cap $name before validating any of them', (limit) => {
    const crowd = Array.from({ length: limit.cap + 1 }, () => null)
    expect(() => parseBackup(fileWith({ [limit.name]: crowd }))).toThrow(
      invalidBackup(`${limit.name}: .*<=${limit.cap}`),
    )
  })

  it('explains what is wrong in the message', () => {
    expect(() => parseBackup('not json')).toThrow(invalidBackup(/not valid JSON/))
    expect(() => parseBackup(fileWith({ version: 2 }))).toThrow(invalidBackup('version'))
  })
})
