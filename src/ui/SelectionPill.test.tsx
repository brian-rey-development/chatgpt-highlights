import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { HIGHLIGHT_COLORS } from '@/model'
import { fakeActions, stubElementBox } from '@/testing'
import { SelectionPill } from './SelectionPill'
import type { PillModel } from './types'

const ANCHOR = new DOMRect(300, 400, 120, 24)
const PILL_BOX = { width: 160, height: 28 }

const stubPillBox = () => stubElementBox(new DOMRect(0, 0, PILL_BOX.width, PILL_BOX.height))

const pillOf = (overrides: Partial<PillModel> = {}): PillModel => ({
  anchor: ANCHOR,
  dock: null,
  ...overrides,
})

describe('SelectionPill', () => {
  it('names five color buttons and the note button', () => {
    render(<SelectionPill model={pillOf()} actions={fakeActions()} />)
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual([
      ...HIGHLIGHT_COLORS.map((color) => `Highlight ${color}`),
      'Highlight and add note',
    ])
  })

  it.each(HIGHLIGHT_COLORS)('highlights the selection %s without a note', (color) => {
    const highlightSelection = vi.fn()
    render(<SelectionPill model={pillOf()} actions={fakeActions({ highlightSelection })} />)
    fireEvent.click(screen.getByRole('button', { name: `Highlight ${color}` }))
    expect(highlightSelection).toHaveBeenCalledExactlyOnceWith(color, false)
  })

  it('highlights in yellow and asks for a note from the note button', () => {
    const highlightSelection = vi.fn()
    render(<SelectionPill model={pillOf()} actions={fakeActions({ highlightSelection })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlight and add note' }))
    expect(highlightSelection).toHaveBeenCalledExactlyOnceWith('yellow', true)
  })

  it('sits 6px above the selection when ChatGPT shows no box of its own', () => {
    stubPillBox()
    render(<SelectionPill model={pillOf()} actions={fakeActions()} />)
    expect(screen.getByRole('toolbar')).toHaveStyle({ left: '300px', top: '366px' })
  })

  it('docks 4px right of the native box and matches its height', () => {
    stubPillBox()
    const dock = new DOMRect(200, 350, 110, 32)
    render(<SelectionPill model={pillOf({ dock })} actions={fakeActions()} />)
    expect(screen.getByRole('toolbar')).toHaveStyle({ left: '314px', top: '350px', height: '32px' })
  })

  it('stays 8px inside the viewport', () => {
    stubPillBox()
    vi.stubGlobal('innerWidth', 400)
    render(<SelectionPill model={pillOf()} actions={fakeActions()} />)
    expect(screen.getByRole('toolbar')).toHaveStyle({ left: '232px' })
  })

  it('keeps the text selection alive when the pill is pressed', () => {
    render(<SelectionPill model={pillOf()} actions={fakeActions()} />)
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    screen.getByRole('button', { name: 'Highlight blue' }).dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
  })
})
