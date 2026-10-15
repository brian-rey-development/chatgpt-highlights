import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { HIGHLIGHT_COLORS } from '@/model'
import { COLOR_LABELS, ColorDots, colorLabel } from './ColorDots'

const labelFor = (color: string) => `Pick ${color}`

describe('COLOR_LABELS', () => {
  it.each(HIGHLIGHT_COLORS)('writes %s in sentence case', (color) => {
    expect(COLOR_LABELS[color]).toBe(`${color.charAt(0).toUpperCase()}${color.slice(1)}`)
  })
})

describe('colorLabel', () => {
  it.each(HIGHLIGHT_COLORS)('names %s the way the library filters do', (color) => {
    expect(colorLabel(color)).toBe(COLOR_LABELS[color])
  })
})

describe('ColorDots', () => {
  it('offers the five colors in palette order', () => {
    render(<ColorDots current={null} size="sm" labelFor={labelFor} onPick={vi.fn()} />)
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(HIGHLIGHT_COLORS.map(labelFor))
  })

  it('reports the color that was picked', () => {
    const onPick = vi.fn()
    render(<ColorDots current={null} size="sm" labelFor={labelFor} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick pink' }))
    expect(onPick).toHaveBeenCalledExactlyOnceWith('pink')
  })

  it('marks no dot as pressed when there is no current color', () => {
    render(<ColorDots current={null} size="sm" labelFor={labelFor} onPick={vi.fn()} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-pressed')
    }
  })

  it('marks only the current color as pressed', () => {
    render(<ColorDots current="blue" size="md" labelFor={labelFor} onPick={vi.fn()} />)
    const pressed = screen.getAllByRole('button', { pressed: true })
    expect(pressed.map((button) => button.getAttribute('data-color'))).toEqual(['blue'])
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4)
  })

  it('carries its size into a class the stylesheet can target', () => {
    const { container } = render(
      <ColorDots current={null} size="md" labelFor={labelFor} onPick={vi.fn()} />,
    )
    expect(container.firstElementChild).toHaveClass('hl-dots--md')
  })

  it('adds no size class for the default small size', () => {
    const { container } = render(
      <ColorDots current={null} size="sm" labelFor={labelFor} onPick={vi.fn()} />,
    )
    expect(container.firstElementChild).toHaveAttribute('class', 'hl-dots')
  })
})
