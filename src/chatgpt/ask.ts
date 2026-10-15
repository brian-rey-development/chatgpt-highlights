import { toBlockquote } from '@/markdown'
import { composerForm } from './messages'
import { ASK_BOX, ASK_BOX_ATTRS, BUTTON, COMPOSER } from './selectors'
import { isVisible } from './visibility'
import { visibleText } from './visible-text'

export type AskResult = 'native' | 'pasted' | 'failed'

export const NEAR_DISTANCE_PX = 60
export const NATIVE_WAIT_MS = 300
const BOX_MUTATIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributeFilter: [...ASK_BOX_ATTRS],
}

const gapBetween = (a: DOMRect, b: DOMRect): number => {
  const dx = Math.max(0, a.left - b.right, b.left - a.right)
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
  return Math.hypot(dx, dy)
}

const isAskBox = (box: Element): boolean =>
  box.querySelectorAll(BUTTON).length === 1 && isVisible(box)

export const nativeAskBox = (doc: Document, near: DOMRect): Element | null =>
  [...doc.querySelectorAll(ASK_BOX)].find(
    (box) => isAskBox(box) && gapBetween(box.getBoundingClientRect(), near) <= NEAR_DISTANCE_PX,
  ) ?? null

const elementOf = (node: Node): Element | null =>
  node instanceof Element ? node : node.parentElement

const simulateRelease = (doc: Document, range: Range): void => {
  const selection = doc.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  const target = elementOf(range.commonAncestorContainer) ?? doc.body
  target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
}

interface AskBoxWatch {
  onBox: (box: Element) => void
  onExpire?: () => void
}

export const watchNativeAskBox = (
  doc: Document,
  near: DOMRect,
  { onBox, onExpire }: AskBoxWatch,
): (() => void) => {
  const observer = new MutationObserver(() => {
    const box = nativeAskBox(doc, near)
    if (box) onBox(box)
  })
  const timer = setTimeout(() => {
    observer.disconnect()
    onExpire?.()
  }, NATIVE_WAIT_MS)
  observer.observe(doc.body, BOX_MUTATIONS)
  return () => {
    clearTimeout(timer)
    observer.disconnect()
  }
}

const waitForNativeBox = (doc: Document, near: DOMRect): Promise<Element | null> => {
  const present = nativeAskBox(doc, near)
  if (present) return Promise.resolve(present)
  return new Promise((resolve) => {
    const stop = watchNativeAskBox(doc, near, {
      onBox: (box) => {
        stop()
        resolve(box)
      },
      onExpire: () => resolve(null),
    })
  })
}

const pasteIntoComposer = (doc: Document, text: string): boolean => {
  const composer = composerForm(doc)?.querySelector<HTMLElement>(COMPOSER)
  if (!composer) return false
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  composer.focus()
  composer.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
  )
  return true
}

export const pasteQuote = (doc: Document, input: { quote: string; note: string }): AskResult => {
  const text = `${toBlockquote(input.quote)}\n\n${input.note}`
  return pasteIntoComposer(doc, text) ? 'pasted' : 'failed'
}

export const askAbout = async (
  doc: Document,
  input: { range: Range; note: string },
): Promise<AskResult> => {
  const { range, note } = input
  simulateRelease(doc, range)
  const box = await waitForNativeBox(doc, range.getBoundingClientRect())
  if (!box) return pasteQuote(doc, { quote: visibleText(range), note })
  box.querySelector(BUTTON)?.click()
  if (note === '') return 'native'
  return pasteIntoComposer(doc, note) ? 'native' : 'failed'
}
