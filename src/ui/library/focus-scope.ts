import type { RefObject } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([hidden]), textarea:not([disabled]), [href]'

const focusableIn = (scope: HTMLElement): HTMLElement[] => [
  ...scope.querySelectorAll<HTMLElement>(FOCUSABLE),
]

const activeIn = (scope: HTMLElement): Element | null => {
  const root = scope.getRootNode()
  return root instanceof ShadowRoot || root instanceof Document ? root.activeElement : null
}

const wrapTarget = (scope: HTMLElement, isBackward: boolean): HTMLElement | undefined => {
  const focusables = focusableIn(scope)
  const active = activeIn(scope)
  if (isBackward)
    return active === focusables[0] || active === scope ? focusables.at(-1) : undefined
  return active === focusables.at(-1) ? focusables[0] : undefined
}

export const useFocusScope = (scope: RefObject<HTMLElement>): ((event: KeyboardEvent) => void) => {
  useLayoutEffect(() => {
    const previous = document.activeElement
    scope.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [scope])
  return (event) => {
    if (event.key !== 'Tab' || !scope.current) return
    const target = wrapTarget(scope.current, event.shiftKey)
    if (!target) return
    event.preventDefault()
    target.focus()
  }
}
