import { listen, type Stop } from './listen'

const ESCAPE_KEY = 'Escape'

type Target = Document | ShadowRoot

// Bubbling on purpose, so menus can claim Escape
export const onEscape = (targets: readonly Target[], onPress: () => void): Stop => {
  const stops = targets.map((target) =>
    listen(target, { type: 'keydown' }, (event) => {
      if (event.key === ESCAPE_KEY) onPress()
    }),
  )
  return () => {
    for (const stop of stops) stop()
  }
}
