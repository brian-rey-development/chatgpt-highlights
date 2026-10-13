import { h, render } from 'preact'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { CHATGPT_MATCH, PAGE_STYLE_ID, PAGE_STYLES } from '@/chatgpt'
import { createPainter, dispose, HIGHLIGHT_STYLES } from '@/painter'
import { App, OVERLAY_STYLES, type UiActions } from '@/ui'
import { IS_E2E_BUILD } from './build-mode'
import { createHighlightActions } from './highlight-actions'
import { createLibraryActions } from './library-actions'
import { startLibraryHost } from './library-host'
import type { Stop } from './listen'
import { mountOverlay, type Overlay } from './overlay'
import { startPointer } from './pointer'
import { startReveal } from './reveal'
import { startSelection } from './selection'
import { startSession } from './session'
import { startStatusChecks } from './status-checks'
import { createStore, type Runtime, type Store } from './store'

const OVERLAY_MODE = IS_E2E_BUILD ? 'open' : 'closed'

const injectPageStyles = (doc: Document): Stop => {
  doc.getElementById(PAGE_STYLE_ID)?.remove()
  const style = doc.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = `${PAGE_STYLES}\n${HIGHLIGHT_STYLES}`
  doc.head.append(style)
  return () => style.remove()
}

const startFeatures = (runtime: Runtime): { actions: UiActions; stops: Stop[] } => {
  const session = startSession(runtime)
  const host = startLibraryHost(runtime, session.afterSettle)
  const reveal = startReveal(runtime, session.afterSettle)
  return {
    actions: {
      ...createHighlightActions(runtime, host),
      ...createLibraryActions(runtime, host, reveal),
    },
    stops: [session.stop, startSelection(runtime), startPointer(runtime), host.stop, reveal.stop],
  }
}

const startRuntime = (store: Store, overlay: Overlay): Stop => {
  const { shadowRoot } = overlay
  const runtime: Runtime = { doc: document, store, painter: createPainter(), shadowRoot }
  const { actions, stops } = startFeatures(runtime)
  render(h(App, { state: store, actions }), overlay.container)
  const allStops = [injectPageStyles(runtime.doc), ...stops, startStatusChecks(runtime)]
  return () => {
    for (const stop of allStops) stop()
    render(null, overlay.container)
    overlay.remove()
    dispose(runtime.painter)
  }
}

export default defineContentScript({
  matches: [CHATGPT_MATCH],
  cssInjectionMode: 'manual',
  main: (ctx) => {
    const overlay = mountOverlay(document, OVERLAY_MODE, OVERLAY_STYLES)
    ctx.onInvalidated(startRuntime(createStore(), overlay))
  },
})
