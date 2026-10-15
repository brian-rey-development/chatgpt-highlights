import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { JSON_MEDIA_TYPE } from '@/model'
import { ImportButton } from './ImportButton'

const fileInput = (container: Element) => {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input')
  return input
}

describe('ImportButton', () => {
  it('is its own labelled control', () => {
    render(<ImportButton onFile={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Import backup' })).toBeInTheDocument()
  })

  it('opens the file picker and accepts only JSON', () => {
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click')
    const { container } = render(<ImportButton onFile={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Import backup' }))
    expect(pick).toHaveBeenCalledOnce()
    expect(fileInput(container)).toHaveAttribute('accept', `.json,${JSON_MEDIA_TYPE}`)
  })

  it('imports the chosen file', () => {
    const onFile = vi.fn()
    const { container } = render(<ImportButton onFile={onFile} />)
    const file = new File(['{}'], 'backup.json', { type: JSON_MEDIA_TYPE })
    fireEvent.change(fileInput(container), { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('ignores a picker closed without a file', () => {
    const onFile = vi.fn()
    const { container } = render(<ImportButton onFile={onFile} />)
    fireEvent.change(fileInput(container), { target: { files: [] } })
    expect(onFile).not.toHaveBeenCalled()
  })
})
