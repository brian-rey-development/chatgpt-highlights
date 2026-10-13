import type { RefObject } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

export const useDismiss = (
  area: RefObject<HTMLElement>,
  active: boolean,
  onDismiss: () => void,
) => {
  useLayoutEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      if (area.current && !event.composedPath().includes(area.current)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [area, active, onDismiss])
}
