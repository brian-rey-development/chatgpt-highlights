import { HIGHLIGHTER_ICON } from '@/model'
import {
  ACTIVE_ATTR,
  DESTINATION_ATTR,
  HISTORY_LINK,
  LIBRARY_DESTINATION,
  NAV_ACTIVE,
  NAV_ACTIVE_CLASS,
  NAV_ATTR,
  OPEN_ATTR,
  SIDEBAR_DESTINATION,
} from './selectors'
import { conversationIdFromPath } from './url'
import { isVisible } from './visibility'

const ARIA_LABEL_ATTR = 'aria-label'
const ICON_SELECTOR = 'svg'
const ANY_ELEMENT = '*'
const LABEL = 'Highlights'
const DESTINATION_ID = 'hl:highlights'
const SVG_NS = 'http://www.w3.org/2000/svg'
const DROPPED_ATTRIBUTES = new RegExp(`^(?:id|${ACTIVE_ATTR})$|onboarding`, 'i')
const INHERITED_ICON_ATTRIBUTES = ['class', 'width', 'height']
const ICON_ATTRIBUTES: Readonly<Record<string, string>> = {
  width: String(HIGHLIGHTER_ICON.size),
  height: String(HIGHLIGHTER_ICON.size),
  ...HIGHLIGHTER_ICON.attributes,
}

export const PAGE_STYLES = `
html[${OPEN_ATTR}] ${NAV_ACTIVE}:not([${NAV_ATTR}]) {
  background-color: transparent !important;
}
html[${OPEN_ATTR}] [${NAV_ATTR}] {
  background-color: var(--color-background-primary-soft-hover);
}
`

const buildIcon = (doc: Document): SVGElement => {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  for (const [name, value] of Object.entries(ICON_ATTRIBUTES)) svg.setAttribute(name, value)
  for (const d of HIGHLIGHTER_ICON.paths) {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

const swapIcon = (entry: HTMLElement): void => {
  const icon = buildIcon(entry.ownerDocument)
  const previous = entry.querySelector(ICON_SELECTOR)
  if (!previous) {
    entry.prepend(icon)
    return
  }
  for (const name of INHERITED_ICON_ATTRIBUTES) {
    const value = previous.getAttribute(name)
    if (value !== null) icon.setAttribute(name, value)
  }
  previous.replaceWith(icon)
}

const labelNodes = (entry: HTMLElement): Text[] =>
  [entry, ...entry.querySelectorAll(ANY_ELEMENT)].flatMap((element) =>
    [...element.childNodes].filter(
      (node): node is Text => node instanceof Text && node.data.trim() !== '',
    ),
  )

const relabel = (entry: HTMLElement): void => {
  const [label, ...extras] = labelNodes(entry)
  if (label) label.data = LABEL
  for (const extra of extras) extra.remove()
}

const cloneAsItem = (source: HTMLElement): HTMLElement => {
  // A clone keeps its element type
  const entry = source.cloneNode(true) as HTMLElement
  for (const name of entry.getAttributeNames()) {
    if (DROPPED_ATTRIBUTES.test(name)) entry.removeAttribute(name)
  }
  entry.classList.remove(NAV_ACTIVE_CLASS)
  entry.setAttribute(ARIA_LABEL_ATTR, LABEL)
  entry.setAttribute(DESTINATION_ATTR, DESTINATION_ID)
  entry.setAttribute(NAV_ATTR, '')
  relabel(entry)
  swapIcon(entry)
  return entry
}

const anchorFor = (doc: Document): HTMLElement | null => {
  const destinations = [...doc.querySelectorAll<HTMLElement>(SIDEBAR_DESTINATION)].filter(isVisible)
  return (
    destinations.find((destination) => destination.matches(LIBRARY_DESTINATION)) ??
    destinations.at(-1) ??
    null
  )
}

export const isItemShown = (entry: HTMLElement | null): boolean =>
  entry?.isConnected === true && isVisible(entry)

export const ensureSidebarItem = (doc: Document, onOpen: () => void): HTMLElement | null => {
  const existing = doc.querySelector<HTMLElement>(`[${NAV_ATTR}]`)
  if (existing && isVisible(existing)) return existing
  const anchor = anchorFor(doc)
  if (!anchor) return existing
  existing?.remove()
  const entry = cloneAsItem(anchor)
  entry.addEventListener(
    'click',
    (event) => {
      event.stopPropagation()
      onOpen()
    },
    { capture: true },
  )
  anchor.after(entry)
  return entry
}

export const conversationLink = (doc: Document, conversationId: string): HTMLAnchorElement | null =>
  [...doc.querySelectorAll<HTMLAnchorElement>(HISTORY_LINK)].find(
    (link) => conversationIdFromPath(link.pathname) === conversationId,
  ) ?? null
