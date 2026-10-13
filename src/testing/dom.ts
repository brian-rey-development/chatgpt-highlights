import { vi } from 'vitest'

export const FRAME_MS = 16

export const ESCAPE_INIT = { key: 'Escape', bubbles: true, composed: true }

const ISOLATED_KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const

interface ReplacedMember {
  target: object
  name: string
  original: PropertyDescriptor | undefined
}

const replaced: ReplacedMember[] = []

export const nextFrame = () => vi.advanceTimersByTimeAsync(FRAME_MS)

export const settle = () => vi.advanceTimersByTimeAsync(0)

export const defineOnPrototype = (target: object, members: Record<string, unknown>): void => {
  for (const [name, value] of Object.entries(members)) {
    replaced.push({ target, name, original: Object.getOwnPropertyDescriptor(target, name) })
    Object.defineProperty(target, name, { configurable: true, writable: true, value })
  }
}

export const restorePrototypes = (): void => {
  for (const { target, name, original } of replaced.splice(0).reverse()) {
    if (original) Object.defineProperty(target, name, original)
    else Reflect.deleteProperty(target, name)
  }
}

export const makeOverlayRoot = (): ShadowRoot => {
  const host = document.createElement('div')
  const root = host.attachShadow({ mode: 'closed' })
  for (const type of ISOLATED_KEY_EVENTS) {
    root.addEventListener(type, (event) => event.stopPropagation())
  }
  document.body.append(host)
  return root
}

export const typeInOverlay = (root: ShadowRoot, key: string): void => {
  const input = document.createElement('input')
  root.append(input)
  input.dispatchEvent(new KeyboardEvent('keydown', { ...ESCAPE_INIT, key }))
}

export const requireElement = <T extends Element = Element>(
  selector: string,
  root: ParentNode = document,
): T => {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`fixture has no ${selector}`)
  return element
}

export const requireText = (element: Element): Text => {
  const text = element.firstChild
  if (!(text instanceof Text)) throw new Error('fixture element has no text')
  return text
}

export const rangeOver = (node: Node): Range => {
  const range = document.createRange()
  range.selectNodeContents(node)
  return range
}

export const selectRange = (range: Range): void => {
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export const stubElementBox = (box: DOMRect): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(box)
}

export const cloneElement = (element: Element): Element => {
  const copy = element.cloneNode(true)
  if (!(copy instanceof Element)) throw new Error('a clone of an element is an element')
  return copy
}

export const documentWithLocation = (doc: Document, location: Partial<Location>): Document =>
  new Proxy(doc, {
    get: (target, property) => {
      if (property === 'location') return location
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
