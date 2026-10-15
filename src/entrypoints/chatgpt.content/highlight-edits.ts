import { findUnit } from '@/chatgpt'
import { request } from '@/messaging'
import {
  type DeletedHighlight,
  type Highlight,
  type HighlightPatch,
  REMOVED_MESSAGE,
} from '@/model'
import { paint, unpaint } from '@/painter'
import { anchorUnits } from './anchor-pass'
import { type Runtime, showFailure, showToast } from './store'

export const UNDO_LABEL = 'Undo'

export const storeHighlight = ({ store }: Runtime, highlight: Highlight): void => {
  store.highlights.value = new Map(store.highlights.value).set(highlight.id, highlight)
}

const forgetHighlight = ({ store }: Runtime, id: string): void => {
  const remaining = new Map(store.highlights.value)
  remaining.delete(id)
  store.highlights.value = remaining
}

const repaint = ({ painter }: Runtime, highlight: Highlight): void => {
  const target = painter.painted.get(highlight.id)
  if (target) paint(painter, { ...target, color: highlight.color, hasNote: highlight.note !== '' })
}

const reinstate = (runtime: Runtime, highlight: Highlight): void => {
  const { doc, store } = runtime
  if (store.conversationId.value !== highlight.conversationId) return
  storeHighlight(runtime, highlight)
  const unit = findUnit(doc, highlight.messageId)
  if (unit) anchorUnits(runtime, [unit])
}

const revertible = (
  current: Highlight,
  previous: Highlight,
  patch: HighlightPatch,
): HighlightPatch => ({
  ...(patch.color !== undefined && current.color === patch.color && { color: previous.color }),
  ...(patch.note !== undefined && current.note === patch.note && { note: previous.note }),
  ...(patch.tags !== undefined && current.tags === patch.tags && { tags: previous.tags }),
})

const applyPatch = (runtime: Runtime, current: Highlight, patch: HighlightPatch): Highlight => {
  const next = { ...current, ...patch }
  storeHighlight(runtime, next)
  repaint(runtime, next)
  return next
}

const showInPopover = ({ store }: Runtime, highlight: Highlight): void => {
  const popover = store.popover.value
  if (popover?.highlight.id === highlight.id) store.popover.value = { ...popover, highlight }
}

const rollBack = (runtime: Runtime, previous: Highlight, patch: HighlightPatch): void => {
  const current = runtime.store.highlights.value.get(previous.id)
  if (!current) return
  const reverted = revertible(current, previous, patch)
  if (Object.keys(reverted).length === 0) return
  showInPopover(runtime, applyPatch(runtime, current, reverted))
}

export const editHighlight = async (
  runtime: Runtime,
  id: string,
  patch: HighlightPatch,
): Promise<void> => {
  const previous = runtime.store.highlights.value.get(id)
  if (previous) applyPatch(runtime, previous, patch)
  const result = await request({ type: 'highlight.update', id, patch })
  if (result.ok) return
  if (previous) rollBack(runtime, previous, patch)
  showFailure(runtime.store, result.error)
}

const undoRemoval = async (runtime: Runtime, deleted: DeletedHighlight): Promise<void> => {
  const result = await request({ type: 'highlight.restore', deleted })
  if (result.ok) reinstate(runtime, result.data)
  else showFailure(runtime.store, result.error)
}

export const removeHighlight = async (runtime: Runtime, id: string): Promise<void> => {
  const { store, painter } = runtime
  const removed = store.highlights.value.get(id)
  if (!removed) return
  unpaint(painter, id)
  forgetHighlight(runtime, id)
  if (store.popover.value?.highlight.id === id) store.popover.value = null
  const result = await request({ type: 'highlight.delete', id })
  if (!result.ok) {
    reinstate(runtime, removed)
    showFailure(store, result.error)
    return
  }
  const deleted = result.data
  if (deleted === null) return
  const undo = { label: UNDO_LABEL, run: () => void undoRemoval(runtime, deleted) }
  showToast(store, { message: REMOVED_MESSAGE, action: undo })
}
