import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { LIMITS } from '@/model'
import { TAG_COUNTER_FROM_CHARS, TagField } from './TagField'

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

  it('removes a tag from its own remove button', () => {
    const onChange = vi.fn()
    render(<TagField tags={['a', 'b', 'c']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag #b' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['a', 'c'])
  })

  it('offers one remove button per tag', () => {
    render(<TagField tags={['a', 'b']} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('keeps a typed tag when the field loses focus', () => {
    const onChange = vi.fn()
    render(<TagField tags={['math']} onChange={onChange} />)
    fireEvent.input(field(), { target: { value: 'Stats' } })
    fireEvent.blur(field())
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['math', 'stats'])
    expect(field()).toHaveValue('')
  })

  it('reports nothing when the field loses focus while empty', () => {
    const onChange = vi.fn()
    render(<TagField tags={[]} onChange={onChange} />)
    fireEvent.blur(field())
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TagField limits', () => {
  const hint = () => screen.queryByRole('status')

  it('shows no hint while the draft is short', () => {
    render(<TagField tags={[]} onChange={vi.fn()} />)
    fireEvent.input(field(), { target: { value: 'x'.repeat(TAG_COUNTER_FROM_CHARS - 1) } })
    expect(hint()).not.toBeInTheDocument()
  })

  it('counts the characters of a long draft against the limit', () => {
    render(<TagField tags={[]} onChange={vi.fn()} />)
    fireEvent.input(field(), { target: { value: 'x'.repeat(TAG_COUNTER_FROM_CHARS) } })
    expect(hint()).toHaveTextContent(`${TAG_COUNTER_FROM_CHARS} / ${LIMITS.tagChars}`)
  })

  it('flags a draft over the limit', () => {
    render(<TagField tags={[]} onChange={vi.fn()} />)
    fireEvent.input(field(), { target: { value: 'x'.repeat(LIMITS.tagChars + 1) } })
    expect(hint()).toHaveClass('hl-tags__hint--over')
  })

  it('says why nothing more can be added once the tag limit is reached', () => {
    const full = Array.from({ length: LIMITS.tags }, (_, index) => `tag-${index}`)
    render(<TagField tags={full} onChange={vi.fn()} />)
    expect(hint()).toHaveTextContent(`Up to ${LIMITS.tags} tags per highlight`)
  })
})
