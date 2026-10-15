import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { DAY_MS, TRASH_LABEL } from '@/model'
import { PURGE_AFTER_MS } from '@/retention'
import { FIXED_TIME, fakeActions, makeConversation, makeHighlight, makeQuote } from '@/testing'
import type { LibraryGroup, UiActions } from '../types'
import { TrashSection } from './TrashSection'
import { absoluteDate } from './time-ago'

const NOW = FIXED_TIME
const DELETE_CHAT = 'Delete chat now'

const TRASHED_DAYS_AGO = 18

const groupOf = (id: string, title: string, daysAgo = TRASHED_DAYS_AGO): LibraryGroup => ({
  conversation: makeConversation({
    id,
    title,
    status: 'trashed',
    trashedAt: NOW - daysAgo * DAY_MS,
  }),
  highlights: [
    makeHighlight({
      id: `${id}-1`,
      conversationId: id,
      quote: makeQuote({ exact: `${title} one` }),
    }),
    makeHighlight({
      id: `${id}-2`,
      conversationId: id,
      quote: makeQuote({ exact: `${title} two` }),
    }),
  ],
})

const buttonAt = (name: string, index: number): HTMLElement => {
  const button = screen.getAllByRole('button', { name })[index]
  if (!button) throw new Error(`no ${name} button at ${index}`)
  return button
}

const renderTrash = (groups: readonly LibraryGroup[], options: { actions?: UiActions } = {}) =>
  render(<TrashSection groups={groups} now={NOW} actions={options.actions ?? fakeActions()} />)

describe('TrashSection', () => {
  it('renders nothing when no chat was deleted', () => {
    const { container } = renderTrash([])
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each deleted chat with its highlights', () => {
    renderTrash([groupOf('a', 'Kafka sizing'), groupOf('b', 'Raft notes')])
    expect(screen.getByRole('heading', { name: TRASH_LABEL })).toBeInTheDocument()
    for (const text of ['Kafka sizing', 'Kafka sizing one', 'Kafka sizing two', 'Raft notes two']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('puts the title in the same header wrapper as the library groups', () => {
    renderTrash([groupOf('a', 'Kafka sizing')])
    const title = screen.getByRole('heading', { name: TRASH_LABEL })
    expect(title.parentElement).toHaveClass('hl-group__head')
    expect(title.parentElement?.tagName).toBe('HEADER')
  })

  it.each([
    { daysAgo: 18, expected: 'Deleted permanently in 12 days' },
    { daysAgo: 29, expected: 'Deleted permanently in 1 day' },
    { daysAgo: 30, expected: 'Deleted permanently today' },
  ])('says "$expected" for a chat trashed $daysAgo days ago', ({ daysAgo, expected }) => {
    renderTrash([groupOf('a', 'Kafka sizing', daysAgo)])
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('names the exact day the chat and its highlights are deleted for good', () => {
    const group = groupOf('a', 'Kafka sizing')
    renderTrash([group])
    const purgeAt = (group.conversation.trashedAt ?? 0) + PURGE_AFTER_MS
    expect(screen.getByText('Deleted permanently in 12 days')).toHaveAttribute(
      'title',
      `Deleted permanently on ${absoluteDate(purgeAt)}`,
    )
  })

  it('gives no exact day when the deletion time is unknown', () => {
    const group = groupOf('a', 'Kafka sizing')
    renderTrash([{ ...group, conversation: { ...group.conversation, trashedAt: null } }])
    expect(screen.getByText(/^Deleted permanently/)).not.toHaveAttribute('title')
  })

  it('copies a deleted highlight as Markdown', () => {
    const copyMarkdown = vi.fn()
    const group = groupOf('a', 'Kafka sizing')
    renderTrash([group], { actions: fakeActions({ copyMarkdown }) })
    fireEvent.click(buttonAt('Copy as Markdown', 0))
    expect(copyMarkdown).toHaveBeenCalledExactlyOnceWith(group.highlights[0])
  })

  it('asks before deleting and does not purge yet', () => {
    const purgeConversation = vi.fn()
    renderTrash([groupOf('a', 'Kafka sizing')], { actions: fakeActions({ purgeConversation }) })
    fireEvent.click(screen.getByRole('button', { name: DELETE_CHAT }))
    expect(
      screen.getByText('Delete this chat and all of its highlights permanently?'),
    ).toBeInTheDocument()
    expect(purgeConversation).not.toHaveBeenCalled()
  })

  it('purges that chat once the inline question is confirmed', () => {
    const purgeConversation = vi.fn()
    renderTrash([groupOf('a', 'Kafka sizing'), groupOf('b', 'Raft notes')], {
      actions: fakeActions({ purgeConversation }),
    })
    fireEvent.click(buttonAt(DELETE_CHAT, 1))
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(purgeConversation).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('goes back to the plain button when the question is cancelled', () => {
    const purgeConversation = vi.fn()
    renderTrash([groupOf('a', 'Kafka sizing')], { actions: fakeActions({ purgeConversation }) })
    fireEvent.click(screen.getByRole('button', { name: DELETE_CHAT }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: DELETE_CHAT })).toBeInTheDocument()
    expect(purgeConversation).not.toHaveBeenCalled()
  })
})
