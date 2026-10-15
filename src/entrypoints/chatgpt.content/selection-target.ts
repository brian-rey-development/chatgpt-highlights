import { type MessageText, readMessageText, spanOfRange } from '@/anchoring'
import { IGNORED_TEXT_SELECTOR, type MessageUnit, unitOf, visibleText } from '@/chatgpt'
import { LIMITS, type Span } from '@/model'

export interface SelectionTarget {
  range: Range
  unit: MessageUnit
  message: MessageText
  span: Span
}

const runsPastText = (range: Range, unit: MessageUnit): boolean => {
  if (unit.textRoot.contains(range.endContainer)) return false
  const tail = range.cloneRange()
  tail.setStartAfter(unit.textRoot)
  return visibleText(tail).trim() !== ''
}

const unitOfSelection = (range: Range): MessageUnit | null => {
  const unit = unitOf(range.startContainer)
  if (!unit?.textRoot.contains(range.startContainer)) return null
  return runsPastText(range, unit) ? null : unit
}

export const selectionTarget = (doc: Document): SelectionTarget | null => {
  const selection = doc.getSelection()
  if (!selection || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const unit = unitOfSelection(range)
  if (!unit) return null
  const message = readMessageText(unit.textRoot, IGNORED_TEXT_SELECTOR)
  const span = spanOfRange(message, range)
  if (!span || span.end - span.start > LIMITS.quoteChars) return null
  return { range, unit, message, span }
}
