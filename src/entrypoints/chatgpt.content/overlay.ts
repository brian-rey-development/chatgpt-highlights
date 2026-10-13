import { APP_SLUG } from '@/model'
import { listen } from './listen'

export interface Overlay {
  shadowRoot: ShadowRoot
  container: HTMLElement
  remove: () => void
}

export const UI_NAME = APP_SLUG

export const OVERLAY_CLASS = 'hl-overlay'

const HOST_RESET = ':host{all:initial !important}'
const ISOLATED_KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const

const scopeToHost = (css: string): string => `${HOST_RESET}\n${css.replaceAll(':root', ':host')}`

export const mountOverlay = (doc: Document, mode: ShadowRootMode, css: string): Overlay => {
  const host = doc.createElement(UI_NAME)
  const shadowRoot = host.attachShadow({ mode })
  const style = doc.createElement('style')
  style.textContent = scopeToHost(css)
  const container = doc.createElement('div')
  container.className = OVERLAY_CLASS
  shadowRoot.append(style, container)
  for (const type of ISOLATED_KEY_EVENTS) {
    listen(shadowRoot, { type }, (event) => event.stopPropagation())
  }
  doc.body.append(host)
  return { shadowRoot, container, remove: () => host.remove() }
}

export const isOverlayEvent = (event: Event): boolean =>
  event.target instanceof Element && event.target.localName === UI_NAME
