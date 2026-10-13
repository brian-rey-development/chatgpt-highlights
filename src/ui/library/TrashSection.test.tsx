import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { DAY_MS, TRASH_LABEL } from '@/model'
import { FIXED_TIME, fakeActions, makeConversation, makeHighlight, makeQuote } from '@/testing'
import type { UiActions } from '../types'
import type { LibraryGroup } from './library-filter'
import { TrashSection } from './TrashSection'

const NOW = FIXED_TIME

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
    { daysAgo: 18, expected: 'Removed in 12 days' },
    { daysAgo: 29, expected: 'Removed in 1 day' },
    { daysAgo: 30, expected: 'Removed today' },
  ])('says "$expected" for a chat trashed $daysAgo days ago', ({ daysAgo, expected }) => {
    renderTrash([groupOf('a', 'Kafka sizing', daysAgo)])
    expect(screen.getByText(expected)).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete now' }))
    expect(screen.getByText('Delete permanently?')).toBeInTheDocument()
    expect(purgeConversation).not.toHaveBeenCalled()
  })

  it('purges that chat once the inline question is confirmed', () => {
    const purgeConversation = vi.fn()
    renderTrash([groupOf('a', 'Kafka sizing'), groupOf('b', 'Raft notes')], {
      actions: fakeActions({ purgeConversation }),
    })
    fireEvent.click(buttonAt('Delete now', 1))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(purgeConversation).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('goes back to the plain button when the question is cancelled', () => {
    const purgeConversation = vi.fn()
    renderTrash([groupOf('a', 'Kafka sizing')], { actions: fakeActions({ purgeConversation }) })
    fireEvent.click(screen.getByRole('button', { name: 'Delete now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Delete now' })).toBeInTheDocument()
    expect(purgeConversation).not.toHaveBeenCalled()
  })
})
