import {
  COMPOSER,
  MAIN,
  MESSAGE_ID_ATTR,
  MESSAGE_UNIT,
  STOP_BUTTON,
  TEXT_ROOT,
  TURN,
  TURN_MESSAGE_IDS_ATTR,
} from './selectors'
import { isVisible } from './visibility'

export interface MessageUnit {
  messageId: string
  element: Element
  textRoot: Element
}

export const CENTERED_SCROLL = { block: 'center' } as const

const UNTITLED_CHAT = 'Untitled chat'
const PRODUCT_NAME = 'ChatGPT'
const ID_SEPARATOR = /[\s,]+/

const toUnit = (element: Element): MessageUnit | null => {
  const messageId = element.getAttribute(MESSAGE_ID_ATTR)
  const textRoot = element.querySelector(TEXT_ROOT)
  if (!messageId || !textRoot) return null
  return { messageId, element, textRoot }
}

export const unitElementOf = (node: Node): Element | null =>
  (node instanceof Element ? node : node.parentElement)?.closest(MESSAGE_UNIT) ?? null

export const unitOf = (node: Node): MessageUnit | null => {
  const element = unitElementOf(node)
  return element ? toUnit(element) : null
}

export const mainPane = (doc: Document): HTMLElement | null =>
  [...doc.querySelectorAll<HTMLElement>(MAIN)].find(isVisible) ?? null

// ChatGPT keeps the old main mounted but hidden
const pageScope = (doc: Document): ParentNode => mainPane(doc) ?? doc

export const unitElements = (doc: Document): NodeListOf<Element> =>
  pageScope(doc).querySelectorAll(MESSAGE_UNIT)

const unitIn = (scope: ParentNode, messageId: string): MessageUnit | null => {
  const element = scope.querySelector(`[${MESSAGE_ID_ATTR}="${CSS.escape(messageId)}"]`)
  return element ? toUnit(element) : null
}

export const findUnit = (doc: Document, messageId: string): MessageUnit | null =>
  unitIn(pageScope(doc), messageId)

const turnListing = (scope: ParentNode, messageId: string): Element | null => {
  const listings = scope.querySelectorAll(`[${TURN_MESSAGE_IDS_ATTR}]`)
  const listing = [...listings].find((candidate) =>
    candidate.getAttribute(TURN_MESSAGE_IDS_ATTR)?.split(ID_SEPARATOR).includes(messageId),
  )
  return listing?.closest(TURN) ?? listing ?? null
}

export const scrollToMessage = (doc: Document, messageId: string): boolean => {
  const scope = pageScope(doc)
  const target = unitIn(scope, messageId)?.element ?? turnListing(scope, messageId)
  if (!target) return false
  target.scrollIntoView(CENTERED_SCROLL)
  return true
}

export const composerForm = (doc: Document): Element | null => {
  const main = mainPane(doc)
  const inPage = main ? (form: Element) => main.contains(form) : isVisible
  const holdsComposer = (form: Element) => form.querySelector(COMPOSER) !== null
  return [...doc.forms].find((form) => inPage(form) && holdsComposer(form)) ?? null
}

export const isGenerating = (doc: Document): boolean => {
  const form = composerForm(doc)
  return form !== null && form.querySelector(STOP_BUTTON) !== null
}

export const threadRoot = (doc: Document): Element | null => {
  const main = mainPane(doc)
  return main?.querySelector(TURN)?.parentElement ?? main
}

export const conversationTitle = (doc: Document): string => {
  const title = doc.title.trim()
  return title === '' || title === PRODUCT_NAME ? UNTITLED_CHAT : title
}
