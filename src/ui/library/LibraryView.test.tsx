import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { DAY_MS, LIBRARY_LABEL, SEARCH_LABEL, type Snapshot, TRASH_LABEL } from '@/model'
import {
  EMPTY_SNAPSHOT,
  FIXED_TIME,
  fakeActions,
  makeConversation,
  makeHighlight,
  makeQuote,
} from '@/testing'
import type { UiActions } from '../types'
import { LibraryView, PAGE_SIZE } from './LibraryView'

const NOW = FIXED_TIME
const FRAME = new DOMRect(260, 52, 900, 700)

const bayes = makeConversation({ id: 'bayes', title: 'Bayesian A/B tests' })
const lsm = makeConversation({ id: 'lsm', title: 'LSM versus B-tree' })
const kafka = makeConversation({
  id: 'kafka',
  title: 'Kafka sizing',
  status: 'trashed',
  trashedAt: NOW - 9 * DAY_MS,
})

const quote = (exact: string) => makeQuote({ exact })

const BASE: Snapshot = {
  conversations: [bayes, lsm, kafka],
  highlights: [
    makeHighlight({
      id: 'prior',
      conversationId: 'bayes',
      quote: quote('An informative prior acts like extra data'),
      color: 'green',
      note: 'Use with the PM team',
      tags: ['stats'],
      createdAt: NOW - 1000,
    }),
    makeHighlight({
      id: 'amp',
      conversationId: 'lsm',
      quote: quote('Measure read amplification first'),
      color: 'blue',
      tags: ['storage'],
      createdAt: NOW - 5000,
    }),
    makeHighlight({
      id: 'sizing',
      conversationId: 'kafka',
      quote: quote('Size partitions for peak throughput'),
      createdAt: NOW - 9000,
    }),
  ],
}

interface Options {
  snapshot?: Snapshot
  actions?: UiActions
  orphanIds?: ReadonlySet<string>
}

const renderLibrary = ({ snapshot = BASE, actions, orphanIds = new Set() }: Options = {}) =>
  render(
    <LibraryView
      model={{ snapshot, now: NOW }}
      frame={FRAME}
      orphanIds={orphanIds}
      actions={actions ?? fakeActions()}
    />,
  )

const search = (text: string) =>
  fireEvent.input(screen.getByRole('textbox', { name: SEARCH_LABEL }), {
    target: { value: text },
  })

const manyHighlights = (count: number): Snapshot => ({
  conversations: [bayes],
  highlights: Array.from({ length: count }, (_, index) =>
    makeHighlight({
      id: `h${index}`,
      conversationId: 'bayes',
      quote: quote(`Passage number ${index}`),
      createdAt: NOW - index,
    }),
  ),
})

describe('LibraryView layout', () => {
  it('fills the frame it is given', () => {
    renderLibrary()
    expect(screen.getByRole('region', { name: LIBRARY_LABEL })).toHaveStyle({
      left: '260px',
      top: '52px',
      width: '900px',
      height: '700px',
    })
  })

  it('titles the view and offers search and the filter chips', () => {
    renderLibrary()
    expect(screen.getByRole('heading', { level: 1, name: 'Highlights' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: SEARCH_LABEL })).toBeInTheDocument()
    for (const name of ['All', 'Yellow', 'Green', 'Blue', 'Pink', 'Purple', '#stats', '#storage']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('groups highlights under their chat, newest chat first', () => {
    renderLibrary()
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual(['Bayesian A/B tests', 'LSM versus B-tree', TRASH_LABEL])
  })

  it('flags an orphan as not found in the chat', () => {
    renderLibrary({ orphanIds: new Set(['amp']) })
    const group = screen.getByRole('region', { name: 'LSM versus B-tree' })
    expect(within(group).getByText('Not found in chat')).toBeInTheDocument()
    expect(screen.getAllByText('Not found in chat')).toHaveLength(1)
  })
})

describe('LibraryView interaction', () => {
  it('jumps to the passage when a row is clicked', () => {
    const jumpTo = vi.fn()
    renderLibrary({ actions: fakeActions({ jumpTo }) })
    fireEvent.click(screen.getByText('Measure read amplification first'))
    expect(jumpTo).toHaveBeenCalledExactlyOnceWith(BASE.highlights[1])
  })

  it('filters while typing, across quote, note and chat title', () => {
    renderLibrary()
    search('PM TEAM')
    expect(screen.getByText('An informative prior acts like extra data')).toBeInTheDocument()
    expect(screen.queryByText('Measure read amplification first')).not.toBeInTheDocument()
    search('b-tree')
    expect(screen.getByText('Measure read amplification first')).toBeInTheDocument()
  })

  it('combines a color chip with the search', () => {
    renderLibrary()
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    expect(screen.queryByText('An informative prior acts like extra data')).not.toBeInTheDocument()
    search('kafka')
    expect(screen.getByText('No highlights match this filter.')).toBeInTheDocument()
  })

  it('filters by tag', () => {
    renderLibrary()
    fireEvent.click(screen.getByRole('button', { name: '#storage' }))
    expect(screen.getByText('Measure read amplification first')).toBeInTheDocument()
    expect(screen.queryByText('An informative prior acts like extra data')).not.toBeInTheDocument()
  })

  it('exports the highlights the filter currently shows', () => {
    const exportMarkdown = vi.fn()
    renderLibrary({ actions: fakeActions({ exportMarkdown }) })
    fireEvent.click(screen.getByRole('button', { name: 'Green' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Markdown' }))
    expect(exportMarkdown).toHaveBeenCalledExactlyOnceWith([BASE.highlights[0]])
  })
})

const SHOW_MORE = { selector: 'button' }
const PARTIAL_LAST_PAGE = 50
const LONG_LIBRARY = 2 * PAGE_SIZE + PARTIAL_LAST_PAGE

describe('LibraryView paging', () => {
  const rowCount = () => document.querySelectorAll('.hl-row').length

  it('renders the first page of rows and offers Show more', () => {
    renderLibrary({ snapshot: manyHighlights(LONG_LIBRARY) })
    expect(rowCount()).toBe(PAGE_SIZE)
    expect(screen.getByText('Show more', SHOW_MORE)).toBeInTheDocument()
  })

  it('adds a page of rows per press and drops the button when everything shows', () => {
    renderLibrary({ snapshot: manyHighlights(LONG_LIBRARY) })
    fireEvent.click(screen.getByText('Show more', SHOW_MORE))
    expect(rowCount()).toBe(2 * PAGE_SIZE)
    fireEvent.click(screen.getByText('Show more', SHOW_MORE))
    expect(rowCount()).toBe(LONG_LIBRARY)
    expect(screen.queryByText('Show more', SHOW_MORE)).not.toBeInTheDocument()
  })

  it('shows no button when one page of rows fits exactly', () => {
    renderLibrary({ snapshot: manyHighlights(PAGE_SIZE) })
    expect(screen.queryByText('Show more', SHOW_MORE)).not.toBeInTheDocument()
  })

  it('goes back to the first page of rows when the filter changes', () => {
    renderLibrary({ snapshot: manyHighlights(LONG_LIBRARY) })
    fireEvent.click(screen.getByText('Show more', SHOW_MORE))
    search('Passage')
    expect(rowCount()).toBe(PAGE_SIZE)
  })
})

describe('LibraryView Recently deleted', () => {
  it('lists the deleted chat with its highlights and the days left', () => {
    renderLibrary()
    const section = screen.getByRole('region', { name: TRASH_LABEL })
    expect(within(section).getByText('Kafka sizing')).toBeInTheDocument()
    expect(within(section).getByText('Size partitions for peak throughput')).toBeInTheDocument()
    expect(within(section).getByText('Removed in 21 days')).toBeInTheDocument()
  })

  it('purges a chat after the inline confirmation', () => {
    const purgeConversation = vi.fn()
    renderLibrary({ actions: fakeActions({ purgeConversation }) })
    fireEvent.click(screen.getByRole('button', { name: 'Delete now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(purgeConversation).toHaveBeenCalledExactlyOnceWith('kafka')
  })

  it('is absent when no chat was deleted', () => {
    renderLibrary({
      snapshot: {
        conversations: [bayes],
        highlights: BASE.highlights.filter((highlight) => highlight.id === 'prior'),
      },
    })
    expect(screen.queryByRole('region', { name: TRASH_LABEL })).not.toBeInTheDocument()
  })
})

describe('LibraryView empty states', () => {
  it('invites the first highlight when nothing is saved', () => {
    renderLibrary({ snapshot: EMPTY_SNAPSHOT })
    expect(screen.getByText(/No highlights yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('says so when the filter matches nothing', () => {
    renderLibrary()
    search('zzz nothing like this')
    expect(screen.getByText('No highlights match this filter.')).toBeInTheDocument()
    expect(screen.queryByText(/No highlights yet/)).not.toBeInTheDocument()
  })
})
