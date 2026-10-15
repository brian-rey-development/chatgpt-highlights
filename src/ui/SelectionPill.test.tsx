import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
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

  describe('with the keyboard', () => {
    it('reaches every color and the note button with Tab, in order', async () => {
      render(<SelectionPill model={pillOf()} actions={fakeActions()} />)
      const user = userEvent.setup()
      const reached: (string | null)[] = []
      for (let press = 0; press < HIGHLIGHT_COLORS.length + 1; press += 1) {
        await user.tab()
        reached.push(document.activeElement?.getAttribute('aria-label') ?? null)
      }
      expect(reached).toEqual([
        ...HIGHLIGHT_COLORS.map((color) => `Highlight ${color}`),
        'Highlight and add note',
      ])
    })

    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('highlights the focused color with $name', async ({ key }) => {
      const highlightSelection = vi.fn()
      render(<SelectionPill model={pillOf()} actions={fakeActions({ highlightSelection })} />)
      const user = userEvent.setup()
      await user.tab()
      await user.tab()
      await user.keyboard(key)
      expect(highlightSelection).toHaveBeenCalledExactlyOnceWith('green', false)
    })

    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('asks for a note from the focused note button with $name', async ({ key }) => {
      const highlightSelection = vi.fn()
      render(<SelectionPill model={pillOf()} actions={fakeActions({ highlightSelection })} />)
      screen.getByRole('button', { name: 'Highlight and add note' }).focus()
      await userEvent.setup().keyboard(key)
      expect(highlightSelection).toHaveBeenCalledExactlyOnceWith('yellow', true)
    })

    it('draws a visible ring around the focused button', () => {
      const css = readFileSync(join(import.meta.dirname, 'SelectionPill.css'), 'utf8')
      expect(css).toMatch(/\.hl-pill button:focus-visible\s*\{[^}]*outline:\s*2px solid/)
    })
  })
})
