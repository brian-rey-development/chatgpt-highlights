import { isGenerating, nativeAskBox, watchNativeAskBox } from '@/chatgpt'
import { overlapsPainted } from '@/painter'
import { onEscape } from './escape-key'
import { listen, type Stop } from './listen'
import { isOverlayEvent } from './overlay'
import { firstLineRect } from './range-rect'
import { selectionTarget } from './selection-target'
import type { Runtime } from './store'

interface Release {
  frame: number | null
  unwatch: Stop | null
}

const LISTENER_OPTIONS = { capture: true, passive: true }

const mayOfferPill = ({ doc, store }: Runtime): boolean =>
  store.conversationId.value !== null &&
  store.popover.value === null &&
  store.library.value === null &&
  !isGenerating(doc)

const boxKey = (box: DOMRect | null): string =>
  box === null ? '' : `${box.left} ${box.top} ${box.width} ${box.height}`

// ChatGPT moves its ask box after the release
const redock =
  ({ store }: Runtime) =>
  (box: Element): void => {
    const pill = store.pill.value
    const dock = box.getBoundingClientRect()
    if (pill && boxKey(pill.dock) !== boxKey(dock)) store.pill.value = { ...pill, dock }
  }

const showPill = (runtime: Runtime, release: Release): void => {
  const { doc, store } = runtime
  const target = mayOfferPill(runtime) ? selectionTarget(doc) : null
  if (!target || overlapsPainted(runtime.painter, target.range)) {
    store.pill.value = null
    return
  }
  const near = target.range.getBoundingClientRect()
  const dock = nativeAskBox(doc, near)
  store.pill.value = {
    anchor: firstLineRect(target.range),
    dock: dock?.getBoundingClientRect() ?? null,
  }
  release.unwatch = watchNativeAskBox(doc, near, { onBox: redock(runtime) })
}

const cancelRelease = (release: Release): void => {
  if (release.frame !== null) cancelAnimationFrame(release.frame)
  release.unwatch?.()
  release.frame = null
  release.unwatch = null
}

const scheduleRelease = (runtime: Runtime, release: Release): void => {
  cancelRelease(release)
  release.frame = requestAnimationFrame(() => showPill(runtime, release))
}

const hidePill = (runtime: Runtime, release: Release): void => {
  cancelRelease(release)
  runtime.store.pill.value = null
}

const dismissAll = (runtime: Runtime, release: Release): void => {
  hidePill(runtime, release)
  runtime.store.popover.value = null
}

const outsideOverlay =
  (action: () => void) =>
  (event: Event): void => {
    if (!isOverlayEvent(event)) action()
  }

export const startSelection = (runtime: Runtime): Stop => {
  const { doc, shadowRoot } = runtime
  const release: Release = { frame: null, unwatch: null }
  const hide = (): void => hidePill(runtime, release)
  const onRelease = outsideOverlay(() => scheduleRelease(runtime, release))
  const onPress = outsideOverlay(() => dismissAll(runtime, release))
  const stops = [
    listen(doc, { type: 'pointerup', ...LISTENER_OPTIONS }, onRelease),
    listen(doc, { type: 'pointerdown', ...LISTENER_OPTIONS }, onPress),
    listen(doc, { type: 'scroll', ...LISTENER_OPTIONS }, hide),
    onEscape([doc, shadowRoot], () => dismissAll(runtime, release)),
  ]
  return () => {
    cancelRelease(release)
    for (const stop of stops) stop()
  }
}
