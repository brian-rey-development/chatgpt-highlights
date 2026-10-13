import { unitElementOf } from '@/chatgpt'
import { hitTest } from '@/painter'
import { listen, type Stop } from './listen'
import { lineRectAt } from './range-rect'
import type { Runtime } from './store'

const isOnMessage = (event: MouseEvent): boolean =>
  event.target instanceof Node && unitElementOf(event.target) !== null

const hasSelection = (doc: Document): boolean => doc.getSelection()?.isCollapsed === false

const openPopover = ({ doc, store, painter }: Runtime, event: MouseEvent): void => {
  const id = hitTest(painter, doc, { x: event.clientX, y: event.clientY })
  const target = id === null ? undefined : painter.painted.get(id)
  const highlight = id === null ? undefined : store.highlights.value.get(id)
  if (!(target && highlight)) return
  store.pill.value = null
  store.popover.value = { highlight, anchor: lineRectAt(target.range, event.clientY) }
}

const onClick = (runtime: Runtime, event: MouseEvent): void => {
  const { doc, painter } = runtime
  if (painter.painted.size === 0 || event.detail > 1) return
  if (!isOnMessage(event) || hasSelection(doc)) return
  openPopover(runtime, event)
}

export const startPointer = (runtime: Runtime): Stop =>
  listen(runtime.doc, { type: 'click', capture: true }, (event) => onClick(runtime, event))
