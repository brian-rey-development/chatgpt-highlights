import { defineOnPrototype } from './dom'

const HIDDEN_VISIBILITY = new Set(['hidden', 'collapse'])

const ancestorsAndSelf = (element: Element): Element[] =>
  element.parentElement ? [element, ...ancestorsAndSelf(element.parentElement)] : [element]

const isDisplayed = (element: Element): boolean =>
  !element.hasAttribute('hidden') && getComputedStyle(element).display !== 'none'

const isOpaque = (element: Element): boolean => getComputedStyle(element).opacity !== '0'

const isShownToPaint = (element: Element): boolean =>
  !HIDDEN_VISIBILITY.has(getComputedStyle(element).visibility)

const isRendered = (element: Element, options: CheckVisibilityOptions): boolean => {
  const chain = ancestorsAndSelf(element)
  if (!chain.every(isDisplayed)) return false
  if (options.opacityProperty && !chain.every(isOpaque)) return false
  return !options.visibilityProperty || isShownToPaint(element)
}

export const installFakeCheckVisibility = (): void => {
  defineOnPrototype(Element.prototype, {
    checkVisibility(this: Element, options: CheckVisibilityOptions = {}): boolean {
      return isRendered(this, options)
    },
  })
}
