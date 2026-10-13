import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeActions } from '@/testing'
import { Toast } from './Toast'
import type { ToastModel } from './types'

const toastOf = (overrides: Partial<ToastModel> = {}): ToastModel => ({
  id: 1,
  message: 'Highlight removed',
  action: null,
  ...overrides,
})

describe('Toast', () => {
  it('announces its message politely', () => {
    render(<Toast model={toastOf()} actions={fakeActions()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Highlight removed')
  })

  it('shows no button when there is no action', () => {
    render(<Toast model={toastOf()} actions={fakeActions()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('runs the action and then dismisses', () => {
    const calls: string[] = []
    const run = vi.fn(() => calls.push('run'))
    const dismissToast = vi.fn(() => calls.push('dismiss'))
    render(
      <Toast
        model={toastOf({ action: { label: 'Undo', run } })}
        actions={fakeActions({ dismissToast })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(calls).toEqual(['run', 'dismiss'])
  })
})
