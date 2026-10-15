import { describeQuote, rangeOfSpan } from '@/anchoring'
import {
  type AskResult,
  askAbout as askComposer,
  conversationTitle,
  pasteQuote,
  unitElementOf,
} from '@/chatgpt'
import { request } from '@/messaging'
import type { Highlight, HighlightColor, HighlightPatch, NewHighlight } from '@/model'
import { paint, unpaint } from '@/painter'
import type { UiActions } from '@/ui'
import { editHighlight, removeHighlight, storeHighlight } from './highlight-edits'
import type { LibraryHost } from './library-host'
import { firstLineRect } from './range-rect'
import { type SelectionTarget, selectionTarget } from './selection-target'
import { type Runtime, showFailure, showMessage } from './store'

export const COMPOSER_FAILED_MESSAGE = "Couldn't reach the composer"

const PLACEHOLDER_PREFIX = 'pending:'

interface Creation {
  color: HighlightColor
  isNoteWanted: boolean
}

interface Drawn {
  target: SelectionTarget
  range: Range
  conversationId: string
}

interface Saved {
  highlight: Highlight
  range: Range
  anchor: DOMRect | null
}

const drawSelection = ({ doc, store }: Runtime): Drawn | null => {
  const target = selectionTarget(doc)
  const range = target && rangeOfSpan(target.message, target.span)
  const conversationId = store.conversationId.value
  return target && range && conversationId !== null ? { target, range, conversationId } : null
}

const newHighlightOf = ({ doc }: Runtime, drawn: Drawn, color: HighlightColor): NewHighlight => ({
  conversationId: drawn.conversationId,
  conversationTitle: conversationTitle(doc),
  messageId: drawn.target.unit.messageId,
  quote: describeQuote(drawn.target.message.text, drawn.target.span),
  color,
  note: '',
})

const adopt = (runtime: Runtime, { highlight, range, anchor }: Saved): void => {
  const { store, painter } = runtime
  if (store.conversationId.value !== highlight.conversationId) return
  storeHighlight(runtime, highlight)
  paint(painter, { id: highlight.id, range, color: highlight.color, hasNote: false })
  if (anchor) store.popover.value = { highlight, anchor }
}

const createFromSelection = async (runtime: Runtime, creation: Creation): Promise<void> => {
  const drawn = drawSelection(runtime)
  if (!drawn) return
  const { doc, store, painter } = runtime
  const { range } = drawn
  const placeholder = `${PLACEHOLDER_PREFIX}${crypto.randomUUID()}`
  paint(painter, { id: placeholder, range, color: creation.color, hasNote: false })
  const anchor = firstLineRect(range)
  doc.getSelection()?.removeAllRanges()
  store.pill.value = null
  const input = newHighlightOf(runtime, drawn, creation.color)
  const result = await request({ type: 'highlight.create', input })
  unpaint(painter, placeholder)
  if (!result.ok) return showFailure(store, result.error)
  adopt(runtime, { highlight: result.data, range, anchor: creation.isNoteWanted ? anchor : null })
}

const askComposerAbout = (
  runtime: Runtime,
  highlight: Highlight,
): Promise<AskResult> | AskResult => {
  const { doc, painter } = runtime
  const painted = painter.painted.get(highlight.id)
  if (painted) return askComposer(doc, { range: painted.range, note: highlight.note })
  return pasteQuote(doc, { quote: highlight.quote.exact, note: highlight.note })
}

const releaseQuoteSelection = (doc: Document): void => {
  const selection = doc.getSelection()
  if (selection?.anchorNode && unitElementOf(selection.anchorNode)) selection.removeAllRanges()
}

const askFor = async (
  runtime: Runtime,
  host: Pick<LibraryHost, 'close'>,
  highlight: Highlight,
): Promise<void> => {
  host.close()
  const outcome = await askComposerAbout(runtime, highlight)
  releaseQuoteSelection(runtime.doc)
  if (outcome === 'failed') showMessage(runtime.store, COMPOSER_FAILED_MESSAGE)
  else runtime.store.popover.value = null
}

type HighlightActions = Pick<
  UiActions,
  | 'highlightSelection'
  | 'updateHighlight'
  | 'removeHighlight'
  | 'askAbout'
  | 'closePopover'
  | 'dismissToast'
>

export const createHighlightActions = (
  runtime: Runtime,
  host: Pick<LibraryHost, 'close'>,
): HighlightActions => ({
  highlightSelection: (color: HighlightColor, isNoteWanted: boolean): void => {
    void createFromSelection(runtime, { color, isNoteWanted })
  },
  updateHighlight: (id: string, patch: HighlightPatch): void => {
    void editHighlight(runtime, id, patch)
  },
  removeHighlight: (id: string): void => {
    void removeHighlight(runtime, id)
  },
  askAbout: (highlight: Highlight): void => {
    void askFor(runtime, host, highlight)
  },
  closePopover: (): void => {
    runtime.store.popover.value = null
  },
  dismissToast: (): void => {
    runtime.store.toast.value = null
  },
})
