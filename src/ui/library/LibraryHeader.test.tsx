import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { HIGHLIGHT_COLORS, SEARCH_LABEL } from '@/model'
import type { LibraryFilter } from '../types'
import { LibraryHeader } from './LibraryHeader'

const NONE: LibraryFilter = { text: '', color: null, tag: null }

const renderHeader = (
  filter: LibraryFilter = NONE,
  tags: readonly string[] = ['math', 'stats'],
) => {
  const onFilter = vi.fn()
  render(
    <LibraryHeader filter={filter} tags={tags} onFilter={onFilter}>
      <span>menu slot</span>
    </LibraryHeader>,
  )
  return onFilter
}

describe('LibraryHeader', () => {
  it('titles the view and hosts the slot beside the title', () => {
    renderHeader()
    expect(screen.getByRole('heading', { level: 1, name: 'Highlights' })).toBeInTheDocument()
    expect(screen.getByText('menu slot')).toBeInTheDocument()
  })

  it('offers All, the five colors and every tag as chips', () => {
    renderHeader()
    const chips = screen.getAllByRole('button').map((chip) => chip.textContent)
    expect(chips).toEqual([
      'All',
      ...HIGHLIGHT_COLORS.map((color) => `${color.charAt(0).toUpperCase()}${color.slice(1)}`),
      '#math',
      '#stats',
    ])
  })

  it('shows the search text and reports every keystroke with the other filters kept', () => {
    const onFilter = renderHeader({ text: 'pri', color: 'blue', tag: null })
    const search = screen.getByRole('textbox', { name: SEARCH_LABEL })
    expect(search).toHaveValue('pri')
    fireEvent.input(search, { target: { value: 'prior' } })
    expect(onFilter).toHaveBeenCalledExactlyOnceWith({ text: 'prior', color: 'blue', tag: null })
  })

  it('presses All only while no color or tag is selected', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument()
  })

  it('selects a color and keeps the search and tag', () => {
    const onFilter = renderHeader({ text: 'x', color: null, tag: 'math' })
    fireEvent.click(screen.getByRole('button', { name: 'Pink' }))
    expect(onFilter).toHaveBeenCalledExactlyOnceWith({ text: 'x', color: 'pink', tag: 'math' })
  })

  it('clears the color when its chip is pressed again', () => {
    const onFilter = renderHeader({ ...NONE, color: 'pink' })
    expect(screen.getByRole('button', { name: 'Pink', pressed: true })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pink' }))
    expect(onFilter).toHaveBeenCalledExactlyOnceWith(NONE)
  })

  it('selects a tag', () => {
    const first = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: '#math' }))
    expect(first).toHaveBeenCalledExactlyOnceWith({ ...NONE, tag: 'math' })
  })

  it('clears an active tag from its own chip', () => {
    const onFilter = renderHeader({ ...NONE, tag: 'math' })
    fireEvent.click(screen.getByRole('button', { name: '#math', pressed: true }))
    expect(onFilter).toHaveBeenCalledExactlyOnceWith(NONE)
  })

  it('resets color and tag from All but keeps the search text', () => {
    const onFilter = renderHeader({ text: 'abc', color: 'green', tag: 'stats' })
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onFilter).toHaveBeenCalledExactlyOnceWith({ text: 'abc', color: null, tag: null })
  })
})
