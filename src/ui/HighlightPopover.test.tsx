import { act, fireEvent, render, screen } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS } from '@/model'
import { fakeActions, makeHighlight, stubElementBox } from '@/testing'
import { colorLabel } from './ColorDots'
import { HighlightPopover, NOTE_COUNTER_FROM_CHARS } from './HighlightPopover'
import { NOTE_AUTOSAVE_MS, SAVED_VISIBLE_MS } from './note-autosave'
import type { PopoverModel } from './types'

const ANCHOR = new DOMRect(300, 100, 120, 24)
const POPOVER_BOX = { width: 320, height: 200 }

const modelOf = (overrides: Parameters<typeof makeHighlight>[0] = {}): PopoverModel => ({
  highlight: makeHighlight({ id: 'h1', color: 'green', note: 'Existing note', ...overrides }),
  anchor: ANCHOR,
})

const note = () => screen.getByRole('textbox', { name: 'Note' })

describe('HighlightPopover', () => {
  beforeEach(() => vi.useFakeTimers())

  it('marks the highlight color as pressed', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(screen.getByRole('button', { name: 'Green', pressed: true })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('recolors through updateHighlight and moves the pressed state', () => {
    const updateHighlight = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ updateHighlight })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Purple' }))
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { color: 'purple' })
    expect(screen.getByRole('button', { name: 'Purple', pressed: true })).toBeInTheDocument()
  })

  it('follows the model when its color is put back', () => {
    const model = modelOf()
    const actions = fakeActions()
    const { rerender } = render(<HighlightPopover model={model} actions={actions} />)
    fireEvent.click(screen.getByRole('button', { name: 'Purple' }))
    rerender(
      <HighlightPopover
        model={{ ...model, highlight: { ...model.highlight } }}
        actions={actions}
      />,
    )
    expect(screen.getByRole('button', { name: 'Green', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Purple', pressed: false })).toBeInTheDocument()
  })

  it('does not call updateHighlight when the current color is picked again', () => {
    const updateHighlight = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ updateHighlight })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Green' }))
    expect(updateHighlight).not.toHaveBeenCalled()
  })

  it('shows the stored note', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(note()).toHaveValue('Existing note')
  })

  it('focuses an empty note so typing can start at once', () => {
    render(<HighlightPopover model={modelOf({ note: '' })} actions={fakeActions()} />)
    expect(note()).toHaveFocus()
  })

  it('focuses the dialog instead of the note when the highlight already has a note', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(screen.getByRole('dialog')).toHaveFocus()
    expect(note()).not.toHaveFocus()
  })

  it('saves the note 400 ms after the last keystroke', () => {
    const updateHighlight = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ updateHighlight })} />)
    fireEvent.input(note(), { target: { value: 'Edited' } })
    vi.advanceTimersByTime(NOTE_AUTOSAVE_MS - 1)
    expect(updateHighlight).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { note: 'Edited' })
  })

  it('flushes a pending note when the popover closes', () => {
    const updateHighlight = vi.fn()
    const { unmount } = render(
      <HighlightPopover model={modelOf()} actions={fakeActions({ updateHighlight })} />,
    )
    fireEvent.input(note(), { target: { value: 'Typed then closed' } })
    unmount()
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { note: 'Typed then closed' })
  })

  it('makes no call when the note is unchanged', () => {
    const updateHighlight = vi.fn()
    const { unmount } = render(
      <HighlightPopover model={modelOf()} actions={fakeActions({ updateHighlight })} />,
    )
    fireEvent.input(note(), { target: { value: 'Existing note' } })
    vi.advanceTimersByTime(NOTE_AUTOSAVE_MS)
    unmount()
    expect(updateHighlight).not.toHaveBeenCalled()
  })

  it('adds a tag through updateHighlight', () => {
    const updateHighlight = vi.fn()
    render(
      <HighlightPopover
        model={modelOf({ tags: ['math'] })}
        actions={fakeActions({ updateHighlight })}
      />,
    )
    const field = screen.getByRole('textbox', { name: 'Add tag' })
    fireEvent.input(field, { target: { value: 'Stats' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { tags: ['math', 'stats'] })
    expect(screen.getByText('#stats')).toBeInTheDocument()
  })

  it('removes the last tag on Backspace in the empty tag field', () => {
    const updateHighlight = vi.fn()
    render(
      <HighlightPopover
        model={modelOf({ tags: ['a', 'b'] })}
        actions={fakeActions({ updateHighlight })}
      />,
    )
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Add tag' }), { key: 'Backspace' })
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { tags: ['a'] })
  })

  it('asks about the highlight with the note as currently typed', () => {
    const askAbout = vi.fn()
    const updateHighlight = vi.fn()
    const model = modelOf()
    render(<HighlightPopover model={model} actions={fakeActions({ askAbout, updateHighlight })} />)
    fireEvent.input(note(), { target: { value: 'Fresh note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this' }))
    expect(askAbout).toHaveBeenCalledExactlyOnceWith({ ...model.highlight, note: 'Fresh note' })
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { note: 'Fresh note' })
  })

  it('removes the highlight and does not save the pending note afterwards', () => {
    const removeHighlight = vi.fn()
    const updateHighlight = vi.fn()
    const { unmount } = render(
      <HighlightPopover
        model={modelOf()}
        actions={fakeActions({ removeHighlight, updateHighlight })}
      />,
    )
    fireEvent.input(note(), { target: { value: 'About to vanish' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    unmount()
    expect(removeHighlight).toHaveBeenCalledExactlyOnceWith('h1')
    expect(updateHighlight).not.toHaveBeenCalled()
  })

  it('closes from a Close button at the right end of the color row', () => {
    const closePopover = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ closePopover })} />)
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveAttribute('title', 'Close')
    expect(close).toHaveClass('hl-icon-button')
    expect(close.previousElementSibling).toBe(
      screen.getByRole('button', { name: 'Purple' }).parentElement,
    )
    fireEvent.click(close)
    expect(closePopover).toHaveBeenCalledOnce()
  })

  it.each([
    {
      name: 'the Close button',
      close: () => fireEvent.click(screen.getByRole('button', { name: 'Close' })),
    },
    { name: 'Escape', close: () => fireEvent.keyDown(note(), { key: 'Escape' }) },
  ])('saves a pending note before $name closes the popover', ({ close }) => {
    const updateHighlight = vi.fn()
    const closePopover = vi.fn()
    render(
      <HighlightPopover
        model={modelOf()}
        actions={fakeActions({ updateHighlight, closePopover })}
      />,
    )
    fireEvent.input(note(), { target: { value: 'Typed just now' } })
    close()
    expect(updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { note: 'Typed just now' })
    expect(closePopover).toHaveBeenCalledOnce()
    expect(updateHighlight.mock.invocationCallOrder[0]).toBeLessThan(
      closePopover.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('closes on Escape', () => {
    const closePopover = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ closePopover })} />)
    fireEvent.keyDown(note(), { key: 'Escape' })
    expect(closePopover).toHaveBeenCalledOnce()
  })

  it('closes on Escape when focus rests on the dialog', () => {
    const closePopover = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ closePopover })} />)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(closePopover).toHaveBeenCalledOnce()
  })

  it('ignores other keys', () => {
    const closePopover = vi.fn()
    render(<HighlightPopover model={modelOf()} actions={fakeActions({ closePopover })} />)
    fireEvent.keyDown(note(), { key: 'a' })
    expect(closePopover).not.toHaveBeenCalled()
  })

  it('opens 8px below the highlight', () => {
    stubElementBox(new DOMRect(0, 0, POPOVER_BOX.width, POPOVER_BOX.height))
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(screen.getByRole('dialog')).toHaveStyle({ left: '300px', top: '132px' })
  })

  it('starts fresh drafts when another highlight takes its place', () => {
    const { rerender } = render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    rerender(
      <HighlightPopover
        model={modelOf({ id: 'h2', color: 'pink', note: 'Other' })}
        actions={fakeActions()}
      />,
    )
    expect(note()).toHaveValue('Other')
    expect(screen.getByRole('button', { name: 'Pink', pressed: true })).toBeInTheDocument()
  })

  it('names the color buttons with the shared color labels', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(screen.getByRole('button', { name: colorLabel('pink') })).toBeInTheDocument()
  })
})

describe('HighlightPopover note feedback', () => {
  beforeEach(() => vi.useFakeTimers())

  const status = () => screen.getByRole('status', { name: 'Note status' })

  it('confirms an autosaved note with a quiet Saved, then lets it fade', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(status()).toBeEmptyDOMElement()
    fireEvent.input(note(), { target: { value: 'Edited' } })
    act(() => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS)
    })
    expect(status()).toHaveTextContent('Saved')
    act(() => {
      vi.advanceTimersByTime(SAVED_VISIBLE_MS)
    })
    expect(status()).toBeEmptyDOMElement()
  })

  it('shows no character counter for a short note', () => {
    render(<HighlightPopover model={modelOf()} actions={fakeActions()} />)
    expect(screen.queryByText(new RegExp(`/ ${LIMITS.noteChars}`))).not.toBeInTheDocument()
  })

  it('counts the characters once the note nears the limit', () => {
    const near = 'x'.repeat(NOTE_COUNTER_FROM_CHARS)
    render(<HighlightPopover model={modelOf({ note: near })} actions={fakeActions()} />)
    expect(screen.getByText(`${NOTE_COUNTER_FROM_CHARS} / ${LIMITS.noteChars}`)).toBeInTheDocument()
  })
})
