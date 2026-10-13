import { fireEvent, render, screen } from '@testing-library/preact'
import { h, render as preactRender } from 'preact'
import { useRef } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'
import { useDismiss } from './dismissal'

interface ProbeProps {
  active: boolean
  onDismiss: () => void
}

const Probe = ({ active, onDismiss }: ProbeProps) => {
  const area = useRef<HTMLDivElement>(null)
  useDismiss(area, active, onDismiss)
  return h('div', null, [
    h('div', { ref: area, key: 'area' }, h('button', { type: 'button' }, 'inside')),
    h('button', { type: 'button', key: 'other' }, 'outside'),
  ])
}

const mount = (props: ProbeProps) => render(h(Probe, props))

describe('useDismiss', () => {
  it('dismisses on a press outside the area', () => {
    const onDismiss = vi.fn()
    mount({ active: true, onDismiss })
    fireEvent.pointerDown(screen.getByText('outside'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('keeps the area open for a press inside it', () => {
    const onDismiss = vi.fn()
    mount({ active: true, onDismiss })
    fireEvent.pointerDown(screen.getByText('inside'))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on Escape and keeps the key from reaching other handlers', () => {
    const onDismiss = vi.fn()
    const elsewhere = vi.fn()
    document.addEventListener('keydown', elsewhere)
    mount({ active: true, onDismiss })
    fireEvent.keyDown(screen.getByText('inside'), { key: 'Escape' })
    document.removeEventListener('keydown', elsewhere)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(elsewhere).not.toHaveBeenCalled()
  })

  it('ignores other keys', () => {
    const onDismiss = vi.fn()
    mount({ active: true, onDismiss })
    fireEvent.keyDown(screen.getByText('inside'), { key: 'a' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('listens only while active', () => {
    const onDismiss = vi.fn()
    mount({ active: false, onDismiss })
    fireEvent.pointerDown(screen.getByText('outside'))
    fireEvent.keyDown(screen.getByText('outside'), { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('listens from the commit that activates it, before any effect has flushed', () => {
    const onDismiss = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    preactRender(h(Probe, { active: true, onDismiss }), host)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    preactRender(null, host)
    host.remove()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('lets Escape through in the commit that deactivates it', () => {
    const onDismiss = vi.fn()
    const elsewhere = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    preactRender(h(Probe, { active: true, onDismiss }), host)
    preactRender(h(Probe, { active: false, onDismiss }), host)
    document.addEventListener('keydown', elsewhere)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.removeEventListener('keydown', elsewhere)
    preactRender(null, host)
    host.remove()
    expect(elsewhere).toHaveBeenCalledOnce()
  })

  it('stops listening once unmounted', () => {
    const onDismiss = vi.fn()
    const { unmount } = mount({ active: true, onDismiss })
    unmount()
    fireEvent.pointerDown(document.body)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
