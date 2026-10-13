import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { LIMITS } from '@/model'
import { TagField } from './TagField'

const field = () => screen.getByRole('textbox', { name: 'Add tag' })

const typeTag = (text: string) => {
  fireEvent.input(field(), { target: { value: text } })
  fireEvent.keyDown(field(), { key: 'Enter' })
}

describe('TagField', () => {
  it('shows the current tags with a hash', () => {
    render(<TagField tags={['statistics', 'math']} onChange={vi.fn()} />)
    expect(screen.getByText('#statistics')).toBeInTheDocument()
    expect(screen.getByText('#math')).toBeInTheDocument()
  })

  it('adds the typed tag on Enter, normalized by the model rules', () => {
    const onChange = vi.fn()
    render(<TagField tags={['math']} onChange={onChange} />)
    typeTag('  #System Design ')
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['math', 'system-design'])
  })

  it('clears the field after a tag is added', () => {
    render(<TagField tags={[]} onChange={vi.fn()} />)
    typeTag('math')
    expect(field()).toHaveValue('')
  })

  it('does not add anything on other keys', () => {
    const onChange = vi.fn()
    render(<TagField tags={[]} onChange={onChange} />)
    fireEvent.input(field(), { target: { value: 'math' } })
    fireEvent.keyDown(field(), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores Enter while an input method is composing', () => {
    const onChange = vi.fn()
    render(<TagField tags={[]} onChange={onChange} />)
    fireEvent.input(field(), { target: { value: 'math' } })
    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps an invalid tag in the field and reports nothing', () => {
    const onChange = vi.fn()
    render(<TagField tags={[]} onChange={onChange} />)
    typeTag('x'.repeat(LIMITS.tagChars + 1))
    expect(onChange).not.toHaveBeenCalled()
    expect(field()).toHaveValue('x'.repeat(LIMITS.tagChars + 1))
  })

  it('clears a duplicate tag without reporting a change', () => {
    const onChange = vi.fn()
    render(<TagField tags={['math']} onChange={onChange} />)
    typeTag('Math')
    expect(onChange).not.toHaveBeenCalled()
    expect(field()).toHaveValue('')
  })

  it('keeps the text when the tag limit is already reached', () => {
    const full = Array.from({ length: LIMITS.tags }, (_, index) => `tag-${index}`)
    const onChange = vi.fn()
    render(<TagField tags={full} onChange={onChange} />)
    typeTag('one-more')
    expect(onChange).not.toHaveBeenCalled()
    expect(field()).toHaveValue('one-more')
  })

  it('removes the last tag on Backspace in an empty field', () => {
    const onChange = vi.fn()
    render(<TagField tags={['a', 'b']} onChange={onChange} />)
    fireEvent.keyDown(field(), { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['a'])
  })

  it('leaves the tags alone on Backspace while there is text to delete', () => {
    const onChange = vi.fn()
    render(<TagField tags={['a']} onChange={onChange} />)
    fireEvent.input(field(), { target: { value: 'ma' } })
    fireEvent.keyDown(field(), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does nothing on Backspace when there are no tags', () => {
    const onChange = vi.fn()
    render(<TagField tags={[]} onChange={onChange} />)
    fireEvent.keyDown(field(), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
