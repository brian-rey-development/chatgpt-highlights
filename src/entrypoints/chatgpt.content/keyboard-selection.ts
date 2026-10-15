import { listen, type Stop } from './listen'
import { isOverlayEvent } from './overlay'
import type { Runtime } from './store'

const TAB_KEY = 'Tab'
const PILL_BUTTON = '[role="toolbar"] button'
const LISTENER_OPTIONS = { capture: true, passive: true }

interface Pointer {
  isHeld: boolean
}

const isPlainTab = (event: KeyboardEvent): boolean =>
  event.key === TAB_KEY && !(event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)

const focusPill = ({ store, shadowRoot }: Runtime, event: KeyboardEvent): void => {
  if (!isPlainTab(event) || isOverlayEvent(event) || store.pill.value === null) return
  const first = shadowRoot.querySelector<HTMLElement>(PILL_BUTTON)
  if (!first) return
  event.preventDefault()
  first.focus()
}

export const startKeyboardSelection = (runtime: Runtime, onSelect: () => void): Stop => {
  const { doc } = runtime
  const pointer: Pointer = { isHeld: false }
  const hold = (isHeld: boolean) => (): void => {
    pointer.isHeld = isHeld
  }
  const stops = [
    listen(doc, { type: 'pointerdown', ...LISTENER_OPTIONS }, hold(true)),
    listen(doc, { type: 'pointerup', ...LISTENER_OPTIONS }, hold(false)),
    listen(doc, { type: 'pointercancel', ...LISTENER_OPTIONS }, hold(false)),
    listen(doc, { type: 'selectionchange' }, () => {
      if (!pointer.isHeld) onSelect()
    }),
    listen(doc, { type: 'keydown', capture: true }, (event) => focusPill(runtime, event)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
}
