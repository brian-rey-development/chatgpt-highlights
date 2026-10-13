import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { DAY_MS } from '@/model'
import { FIXED_TIME, fakeActions, makeHighlight, makeQuote } from '@/testing'
import type { UiActions } from '../types'
import { HighlightRow } from './HighlightRow'

const NOW = FIXED_TIME + 3 * DAY_MS

const highlight = makeHighlight({
  id: 'h1',
  quote: makeQuote({ exact: 'An informative prior acts like extra data' }),
  color: 'green',
  note: 'Use this framing with the PM team',
  tags: ['statistics', 'ab'],
})

const renderRow = (props: { orphan?: boolean; inTrash?: boolean; actions?: UiActions } = {}) =>
  render(
    <HighlightRow
      highlight={highlight}
      now={NOW}
      orphan={props.orphan ?? false}
      inTrash={props.inTrash ?? false}
      actions={props.actions ?? fakeActions()}
    />,
  )

describe('HighlightRow', () => {
  it('shows the quote, the note, the age and the tags', () => {
    renderRow()
    expect(screen.getByText('An informative prior acts like extra data')).toBeInTheDocument()
    expect(screen.getByText('Use this framing with the PM team')).toBeInTheDocument()
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
    expect(screen.getByText('#statistics')).toBeInTheDocument()
    expect(screen.getByText('#ab')).toBeInTheDocument()
  })

  it('carries the highlight color on its bar', () => {
    const { container } = renderRow()
    expect(container.querySelector('.hl-row__bar')).toHaveAttribute('data-color', 'green')
  })

  it('leaves out the note line when the highlight has no note', () => {
    render(
      <HighlightRow
        highlight={{ ...highlight, note: '' }}
        now={NOW}
        orphan={false}
        inTrash={false}
        actions={fakeActions()}
      />,
    )
    expect(screen.queryByText('Use this framing with the PM team')).not.toBeInTheDocument()
  })

  it('jumps to the passage when the row is clicked', () => {
    const jumpTo = vi.fn()
    renderRow({ actions: fakeActions({ jumpTo }) })
    fireEvent.click(screen.getByText('An informative prior acts like extra data'))
    expect(jumpTo).toHaveBeenCalledExactlyOnceWith(highlight)
  })

  it.each([
    { label: 'Ask about this', action: 'askAbout' },
    { label: 'Copy as Markdown', action: 'copyMarkdown' },
    { label: 'Open in chat', action: 'jumpTo' },
  ] as const)('$label calls $action with the highlight', ({ label, action }) => {
    const actions = fakeActions()
    renderRow({ actions })
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(actions[action]).toHaveBeenCalledExactlyOnceWith(highlight)
  })

  it('marks an orphan as not found in the chat', () => {
    renderRow({ orphan: true })
    expect(screen.getByText('Not found in chat')).toBeInTheDocument()
  })

  it('does not flag a highlight that is in the chat', () => {
    renderRow()
    expect(screen.queryByText('Not found in chat')).not.toBeInTheDocument()
  })

  it('offers only copy in Recently deleted, and a click does not jump', () => {
    const actions = fakeActions()
    renderRow({ inTrash: true, actions })
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['Copy as Markdown'])
    fireEvent.click(screen.getByText('An informative prior acts like extra data'))
    expect(actions.jumpTo).not.toHaveBeenCalled()
  })

  it('still copies from Recently deleted', () => {
    const actions = fakeActions()
    renderRow({ inTrash: true, actions })
    fireEvent.click(screen.getByRole('button', { name: 'Copy as Markdown' }))
    expect(actions.copyMarkdown).toHaveBeenCalledExactlyOnceWith(highlight)
  })
})
