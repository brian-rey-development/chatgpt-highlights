import { IGNORED_TEXT_SELECTOR } from './selectors'

export const visibleText = (range: Range): string => {
  const fragment = range.cloneContents()
  for (const ignored of fragment.querySelectorAll(IGNORED_TEXT_SELECTOR)) ignored.remove()
  return fragment.textContent
}
