import { unitElementOf } from '@/chatgpt'

export const CROSSING_MESSAGE = 'Select within one message to highlight it'

export const crossesMessages = (doc: Document): boolean => {
  const selection = doc.getSelection()
  if (!selection || selection.isCollapsed) return false
  const range = selection.getRangeAt(0)
  const start = unitElementOf(range.startContainer)
  return start !== null && start !== unitElementOf(range.endContainer)
}
