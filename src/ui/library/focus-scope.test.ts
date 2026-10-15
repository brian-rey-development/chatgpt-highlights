import { fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { useRef } from 'preact/hooks'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFocusScope } from './focus-scope'

const Probe = () => {
  const scope = useRef<HTMLElement>(null)
  const onKeyDown = useFocusScope(scope)
  return h('section', { ref: scope, tabIndex: -1, 'aria-label': 'scope', onKeyDown }, [
    h('button', { type: 'button', key: 'first' }, 'first'),
    h('button', { type: 'button', key: 'disabled', disabled: true }, 'disabled'),
    h('input', { type: 'file', key: 'file', hidden: true }),
    h('button', { type: 'button', key: 'middle' }, 'middle'),
    h('button', { type: 'button', key: 'last' }, 'last'),
  ])
}

const press = (target: Element, options: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key: 'Tab', ...options })

const control = (name: string) => screen.getByRole('button', { name })

const opener = () => {
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  return button
}

describe('useFocusScope', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('moves focus into the scope when it opens', () => {
    opener()
    render(h(Probe, null))
    expect(screen.getByRole('region')).toHaveFocus()
  })

  it('puts focus back where it was when the scope closes', () => {
    const before = opener()
    const { unmount } = render(h(Probe, null))
    unmount()
    expect(before).toHaveFocus()
  })

  it('leaves focus alone when the earlier element is gone', () => {
    const before = opener()
    const { unmount } = render(h(Probe, null))
    before.remove()
    unmount()
    expect(document.body).toHaveFocus()
  })

  it('wraps Tab from the last control to the first', () => {
    render(h(Probe, null))
    control('last').focus()
    expect(press(control('last'))).toBe(false)
    expect(control('first')).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    render(h(Probe, null))
    control('first').focus()
    expect(press(control('first'), { shiftKey: true })).toBe(false)
    expect(control('last')).toHaveFocus()
  })

  it('wraps Shift+Tab from the scope itself to the last control', () => {
    render(h(Probe, null))
    press(screen.getByRole('region'), { shiftKey: true })
    expect(control('last')).toHaveFocus()
  })

  it('lets Tab move on naturally between inner controls', () => {
    render(h(Probe, null))
    control('middle').focus()
    expect(press(control('middle'))).toBe(true)
    expect(press(control('middle'), { shiftKey: true })).toBe(true)
  })

  it('ignores other keys', () => {
    render(h(Probe, null))
    control('last').focus()
    expect(fireEvent.keyDown(control('last'), { key: 'a' })).toBe(true)
  })

  it('works inside a shadow root', () => {
    const shadow = document.body.appendChild(document.createElement('div')).attachShadow({
      mode: 'open',
    })
    const container = shadow.appendChild(document.createElement('div'))
    render(h(Probe, null), { container })
    const buttons = [...container.querySelectorAll('button')]
    const [first] = buttons
    const last = buttons.at(-1)
    if (!first || !last) throw new Error('no buttons')
    last.focus()
    press(last)
    expect(shadow.activeElement).toBe(first)
  })
})
