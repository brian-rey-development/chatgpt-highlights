import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeActions, makeConversation, makeHighlight } from '@/testing'
import type { UiActions } from '../types'
import { ExportMenu } from './ExportMenu'

const FIRST = makeHighlight({ id: 'a' })
const SECOND = makeHighlight({ id: 'b' })
const GROUPS = [
  { conversation: makeConversation({ id: 'one' }), highlights: [FIRST] },
  { conversation: makeConversation({ id: 'two' }), highlights: [SECOND] },
]

const openMenu = (actions: UiActions = fakeActions()) => {
  const view = render(<ExportMenu groups={GROUPS} actions={actions} />)
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  return view
}

describe('ExportMenu', () => {
  it('stays closed until the Export button is pressed', () => {
    render(<ExportMenu groups={GROUPS} actions={fakeActions()} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('lists the two exports and leaves importing to its own button', () => {
    openMenu()
    const names = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(names).toEqual(['Markdown', 'Back up as JSON'])
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('exports every group it was given as Markdown', () => {
    const exportMarkdown = vi.fn()
    openMenu(fakeActions({ exportMarkdown }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Markdown' }))
    expect(exportMarkdown).toHaveBeenCalledExactlyOnceWith(GROUPS)
  })

  it('backs up as JSON', () => {
    const exportBackup = vi.fn()
    openMenu(fakeActions({ exportBackup }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Back up as JSON' }))
    expect(exportBackup).toHaveBeenCalledOnce()
  })

  it('closes after an item is chosen', () => {
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Markdown' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and on a press outside', () => {
    openMenu()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
