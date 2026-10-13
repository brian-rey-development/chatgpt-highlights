const OPTIONS = { opacityProperty: true, visibilityProperty: true }

export const isVisible = (element: Element): boolean => element.checkVisibility(OPTIONS)
