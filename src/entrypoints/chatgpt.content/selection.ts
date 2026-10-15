import { isGenerating, isTemporaryChat, nativeAskBox, watchNativeAskBox } from '@/chatgpt'
import { TEMPORARY_CHAT_MESSAGE } from '@/model'
import { overlapsPainted } from '@/painter'
import type { PillModel } from '@/ui'
import { CROSSING_MESSAGE, crossesMessages } from './crossing-selection'
import { onEscape } from './escape-key'
import { startKeyboardSelection } from './keyboard-selection'
import { listen, type Stop } from './listen'
import { isOverlayEvent } from './overlay'
import { firstLineRect } from './range-rect'
import { type SelectionTarget, selectionTarget } from './selection-target'
import { type Runtime, showMessage } from './store'

interface Release {
  frame: number | null
  unwatch: Stop | null
  isTold: boolean
  isCrossing: boolean
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

const declineTemporaryChat = ({ store }: Runtime, release: Release): void => {
  store.pill.value = null
  if (release.isTold) return
  release.isTold = true
  showMessage(store, TEMPORARY_CHAT_MESSAGE)
}

const tellCrossing = ({ store }: Runtime, release: Release, isCrossing: boolean): void => {
  const isNew = isCrossing && !release.isCrossing
  release.isCrossing = isCrossing
  if (isNew) showMessage(store, CROSSING_MESSAGE)
}

const targetToOffer = (runtime: Runtime, release: Release): SelectionTarget | null => {
  const { doc } = runtime
  const target = mayOfferPill(runtime) ? selectionTarget(doc) : null
  const isCrossing = mayOfferPill(runtime) && !isTemporaryChat(doc.location.search)
  tellCrossing(runtime, release, isCrossing && target === null && crossesMessages(doc))
  return target
}

const samePill = (shown: PillModel | null, next: PillModel): boolean =>
  shown !== null &&
  boxKey(shown.anchor) === boxKey(next.anchor) &&
  boxKey(shown.dock) === boxKey(next.dock)

const showPill = (runtime: Runtime, release: Release): void => {
  const { doc, store } = runtime
  const target = targetToOffer(runtime, release)
  if (!target || overlapsPainted(runtime.painter, target.range)) {
    store.pill.value = null
    return
  }
  if (isTemporaryChat(doc.location.search)) {
    declineTemporaryChat(runtime, release)
    return
  }
  const near = target.range.getBoundingClientRect()
  const dock = nativeAskBox(doc, near)
  const next = { anchor: firstLineRect(target.range), dock: dock?.getBoundingClientRect() ?? null }
  if (!samePill(store.pill.value, next)) store.pill.value = next
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
  const release: Release = { frame: null, unwatch: null, isTold: false, isCrossing: false }
  const hide = (): void => hidePill(runtime, release)
  const onRelease = outsideOverlay(() => scheduleRelease(runtime, release))
  const onPress = outsideOverlay(() => dismissAll(runtime, release))
  const stops = [
    listen(doc, { type: 'pointerup', ...LISTENER_OPTIONS }, onRelease),
    listen(doc, { type: 'pointerdown', ...LISTENER_OPTIONS }, onPress),
    listen(doc, { type: 'scroll', ...LISTENER_OPTIONS }, hide),
    onEscape([doc, shadowRoot], () => dismissAll(runtime, release)),
    startKeyboardSelection(runtime, () => scheduleRelease(runtime, release)),
  ]
  return () => {
    cancelRelease(release)
    for (const stop of stops) stop()
  }
}
