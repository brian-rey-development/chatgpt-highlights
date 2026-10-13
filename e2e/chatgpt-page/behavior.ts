export interface BehaviorConfig {
  askBox: string
  composer: string
  composerForm: string
  main: string
  messageUnit: string
  nativeQuoteAttr: string
  scrollRestoreDelayMs: number
}

// Runs inside the page, so it closes over nothing
export const installBehavior = (config: BehaviorConfig): void => {
  const askBoxGap = 6
  const latePlacementShift = 24
  const latePlacementFrames = 2

  const selectedMessageRange = (): Range | null => {
    const selection = document.getSelection()
    if (!selection || selection.isCollapsed) return null
    const range = selection.getRangeAt(0)
    const inside = range.startContainer.parentElement?.closest(config.messageUnit)
    return inside ? range : null
  }

  const askFrame = (): HTMLElement | null =>
    document.querySelector(config.askBox)?.parentElement ?? null

  const hideAskBox = (): void => {
    const frame = askFrame()
    if (frame) frame.hidden = true
  }

  const placeLater = (frame: HTMLElement, at: { left: number; top: number }, frames: number) => {
    if (frames > 0) requestAnimationFrame(() => placeLater(frame, at, frames - 1))
    else {
      frame.style.left = `${at.left}px`
      frame.style.top = `${at.top}px`
    }
  }

  const showAskBox = (range: Range): void => {
    const frame = askFrame()
    if (!frame) return
    const rect = range.getBoundingClientRect()
    const top = rect.bottom + askBoxGap
    frame.style.top = `${top}px`
    frame.style.left = `${rect.left}px`
    frame.hidden = false
    const shifted = { left: rect.left + latePlacementShift, top: top + latePlacementShift }
    placeLater(frame, shifted, latePlacementFrames)
  }

  document.addEventListener('DOMContentLoaded', hideAskBox)

  document.addEventListener('pointerup', () => {
    const range = selectedMessageRange()
    if (range) showAskBox(range)
    else hideAskBox()
  })

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element && askFrame()?.contains(event.target))) hideAskBox()
  })

  document.addEventListener('click', (event) => {
    const frame = askFrame()
    if (!(event.target instanceof Element && frame?.contains(event.target))) return
    const quote = document.createElement('div')
    quote.setAttribute(config.nativeQuoteAttr, '')
    quote.textContent = document.getSelection()?.toString() ?? ''
    document.querySelector(config.composerForm)?.prepend(quote)
    document.getSelection()?.removeAllRanges()
    hideAskBox()
  })

  const composerFor = (target: EventTarget | null): Element | null => {
    const composer = document.querySelector(config.composer)
    return composer && target instanceof Node && composer.contains(target) ? composer : null
  }

  const paragraphsOf = (text: string): HTMLElement[] =>
    text.split('\n').map((line) => {
      const paragraph = document.createElement('p')
      paragraph.textContent = line
      return paragraph
    })

  document.addEventListener('paste', (event) => {
    const composer = composerFor(event.target)
    if (!composer) return
    event.preventDefault()
    const paragraphs = paragraphsOf(event.clipboardData?.getData('text/plain') ?? '')
    if (composer.textContent === '') composer.replaceChildren(...paragraphs)
    else composer.append(...paragraphs)
  })

  let savedMainScroll = 0
  let restorePending = false

  document.addEventListener(
    'scroll',
    (event) => {
      const main = document.querySelector(config.main)
      const isUserScroll = !location.hash && !restorePending
      if (main && event.target === main && isUserScroll) savedMainScroll = main.scrollTop
    },
    true,
  )

  const restoreMainScroll = (): void => {
    const main = document.querySelector(config.main)
    if (main && !location.hash) main.scrollTop = savedMainScroll
    restorePending = false
  }

  window.addEventListener('popstate', () => {
    restorePending = true
    setTimeout(restoreMainScroll, config.scrollRestoreDelayMs)
  })
}
