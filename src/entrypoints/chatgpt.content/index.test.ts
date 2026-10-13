import { fireEvent, within } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentScriptContext } from 'wxt/utils/content-script-context'
import {
  CHATGPT_MATCH,
  INERT_ATTR,
  LIBRARY_ADDRESS,
  LIBRARY_DESTINATION,
  MAIN,
  NAV_ATTR,
  OPEN_ATTR,
  PAGE_STYLE_ID,
  PAGE_STYLES,
} from '@/chatgpt'
import { ok } from '@/errors'
import { fieldOf, LIBRARY_LABEL, type Snapshot } from '@/model'
import { HIGHLIGHT_STYLES } from '@/painter'
import {
  conversationHtml,
  countPaintedRanges,
  deliverMessage,
  EMPTY_LOAD,
  EMPTY_SNAPSHOT,
  ESCAPE_INIT,
  FIRST_ANSWER_ID,
  FIRST_LINE_BOX,
  FIXTURE_CHAT_PATH,
  FIXTURE_CONVERSATION_ID,
  FIXTURE_DATA_CHANGED,
  FRAME_MS,
  highlightIn,
  installFakeBackground,
  installFakeChatGptApi,
  installFakeHighlightApi,
  installFakeRangeBox,
  installFakeResizeObserver,
  installFakeScrollIntoView,
  LIBRARY_OPEN,
  MAIN_NAV,
  makeConversation,
  mountFixture,
  nextFrame,
  PULL_QUOTE,
  rangeOfQuote,
  requireElement,
  requireUnit,
  selectRange,
  sidebarHtml,
  threadContainer,
  typeInOverlay,
} from '@/testing'
import { OVERLAY_STYLES } from '@/ui'
import script from './index'
import { UI_NAME } from './overlay'

const PAGE_STYLE_SELECTOR = `#${PAGE_STYLE_ID}`
const KEY_EVENT = { key: 'a', bubbles: true, composed: true }
const TRAVERSAL_MS = 50
const RESTORE_DELAY_MS = 1_000
const SCROLLED_TO_HIGHLIGHT = 'scrolled to the highlight'
const SCROLL_RESTORED = 'scroll restored'

let registry: HighlightRegistry

const inOverlay = (root: ShadowRoot) => within(requireElement<HTMLElement>('div', root))

const shadowHosts = (): Element[] => [...document.querySelectorAll(UI_NAME)]

const startWithOverlay = async (): Promise<{ ctx: ContentScriptContext; root: ShadowRoot }> => {
  const attach = vi.spyOn(Element.prototype, 'attachShadow')
  const ctx = startScript()
  await nextFrame()
  const root = attach.mock.results[0]?.value
  if (!(root instanceof ShadowRoot)) throw new Error('no shadow root was attached')
  return { ctx, root }
}

const startScript = (): ContentScriptContext => {
  const ctx = new ContentScriptContext('chatgpt', script)
  script.main(ctx)
  return ctx
}

beforeEach(() => {
  vi.useFakeTimers()
  registry = installFakeHighlightApi()
  installFakeResizeObserver()
  vi.stubGlobal('CSS', { highlights: registry, escape: CSS.escape })
  window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
  mountFixture(conversationHtml)
  document.head.replaceChildren()
})

describe('chatgpt content script', () => {
  it('runs on ChatGPT only and leaves the stylesheet to the shadow root it builds', () => {
    expect(script.matches).toEqual([CHATGPT_MATCH])
    expect(script.cssInjectionMode).toBe('manual')
  })

  it('mounts the app inside a shadow root', () => {
    startScript()
    expect(shadowHosts()).toHaveLength(1)
  })

  it('injects the page styles once, even when started twice', () => {
    startScript()
    startScript()
    const styles = document.querySelectorAll(PAGE_STYLE_SELECTOR)
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain(PAGE_STYLES)
    expect(styles[0]?.textContent).toContain(HIGHLIGHT_STYLES)
  })

  it('starts the session', async () => {
    const background = installFakeBackground()
    background.answerWith(() => ok(EMPTY_LOAD))
    startScript()
    await nextFrame()
    expect(background.sent('conversation.load')).toEqual([
      { type: 'conversation.load', conversationId: FIXTURE_CONVERSATION_ID },
    ])
  })

  it('removes everything it added when the context is invalidated', async () => {
    const ctx = startScript()
    const background = installFakeBackground()
    ctx.notifyInvalidated()
    expect(shadowHosts()).toHaveLength(0)
    expect(document.querySelector(PAGE_STYLE_SELECTOR)).toBeNull()
    expect(registry.size).toBe(0)
    await deliverMessage(FIXTURE_DATA_CHANGED)
    threadContainer().append(document.createElement('span'))
    await nextFrame()
    expect(background.sent()).toEqual([])
  })

  it('keeps keystrokes typed in the extension UI away from the page', async () => {
    const { root } = await startWithOverlay()
    const input = document.createElement('input')
    root.append(input)
    const heard = vi.fn()
    document.addEventListener('keydown', heard)
    input.dispatchEvent(new KeyboardEvent('keydown', KEY_EVENT))
    document.removeEventListener('keydown', heard)
    expect(heard).not.toHaveBeenCalled()
  })

  it('styles the overlay with the bundled stylesheets', async () => {
    const { root } = await startWithOverlay()
    const css = root.querySelector('style')?.textContent ?? ''
    expect(OVERLAY_STYLES).not.toBe('')
    expect(css).toContain(OVERLAY_STYLES.replaceAll(':root', ':host'))
  })

  it('hides the extension UI from page scripts', async () => {
    await startWithOverlay()
    expect(document.querySelector(UI_NAME)?.shadowRoot).toBeNull()
  })
})

const selectPullQuote = async (): Promise<void> => {
  installFakeRangeBox(FIRST_LINE_BOX)
  selectRange(rangeOfQuote(FIRST_ANSWER_ID, PULL_QUOTE))
  requireUnit(FIRST_ANSWER_ID).textRoot.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true }),
  )
  await nextFrame()
}

describe('highlighting flow', () => {
  it('offers the selection pill for a selection inside an answer', async () => {
    const { root } = await startWithOverlay()
    await selectPullQuote()
    expect(inOverlay(root).getByRole('toolbar')).toBeInTheDocument()
  })

  it('saves and paints the highlight when a color is picked', async () => {
    const background = installFakeBackground()
    background.answerWith((message) =>
      ok(
        fieldOf(message, 'type') === 'highlight.create'
          ? highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
          : EMPTY_LOAD,
      ),
    )
    const { root } = await startWithOverlay()
    await selectPullQuote()
    fireEvent.click(inOverlay(root).getByRole('button', { name: 'Highlight green' }))
    await nextFrame()
    expect(background.sent('highlight.create')).toHaveLength(1)
    expect(countPaintedRanges(registry)).toBe(1)
  })
})

describe('the highlight popover', () => {
  const openPopover = async (): Promise<{
    root: ShadowRoot
    background: ReturnType<typeof installFakeBackground>
  }> => {
    const background = installFakeBackground()
    background.answerWith((message) =>
      ok(
        fieldOf(message, 'type') === 'highlight.create'
          ? highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
          : EMPTY_LOAD,
      ),
    )
    const { root } = await startWithOverlay()
    await selectPullQuote()
    fireEvent.click(inOverlay(root).getByRole('button', { name: 'Highlight and add note' }))
    await nextFrame()
    return { root, background }
  }

  const typeNote = (root: ShadowRoot, text: string): void => {
    fireEvent.input(inOverlay(root).getByRole('textbox', { name: 'Note' }), {
      target: { value: text },
    })
  }

  it.each([
    {
      name: 'the Close button',
      close: (root: ShadowRoot) =>
        fireEvent.click(inOverlay(root).getByRole('button', { name: 'Close' })),
    },
    {
      name: 'Escape typed on the page',
      close: () => document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT)),
    },
    {
      name: 'Escape typed in the overlay',
      close: (root: ShadowRoot) => typeInOverlay(root, 'Escape'),
    },
  ])('closes with $name and keeps the note typed just before', async ({ close }) => {
    const { root, background } = await openPopover()
    typeNote(root, 'Typed just now')
    close(root)
    await nextFrame()
    expect(inOverlay(root).queryByRole('dialog')).not.toBeInTheDocument()
    expect(background.sent('highlight.update')).toEqual([
      { type: 'highlight.update', id: expect.any(String), patch: { note: 'Typed just now' } },
    ])
  })
})

const LIBRARY = { name: LIBRARY_LABEL }

const answerFor = (type: unknown, snapshot: Snapshot) => {
  if (type === 'library.snapshot') return ok(snapshot)
  return ok(type === 'conversations.list' ? [] : EMPTY_LOAD)
}

const answerSnapshots = (background: ReturnType<typeof installFakeBackground>): void =>
  background.answerWith((message) => answerFor(fieldOf(message, 'type'), EMPTY_SNAPSHOT))

const clickSidebarItem = (): void => {
  const library = requireElement(`${MAIN_NAV} ${LIBRARY_DESTINATION}`)
  library.nextElementSibling?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const openLibraryFromSidebar = async (): Promise<ShadowRoot> => {
  const { root } = await startWithOverlay()
  clickSidebarItem()
  await nextFrame()
  return root
}

describe('Highlights view', () => {
  beforeEach(() => {
    mountFixture(conversationHtml + sidebarHtml)
    installFakeResizeObserver()
    answerSnapshots(installFakeBackground())
  })

  it('adds the sidebar item and opens the view over the page when it is clicked', async () => {
    const root = await openLibraryFromSidebar()
    expect(inOverlay(root).getByRole('region', LIBRARY)).toBeInTheDocument()
    expect(document.documentElement.hasAttribute(OPEN_ATTR)).toBe(true)
  })

  it('closes on Escape on the page when no menu is open', async () => {
    const root = await openLibraryFromSidebar()
    document.body.dispatchEvent(new KeyboardEvent('keydown', ESCAPE_INIT))
    await nextFrame()
    expect(inOverlay(root).queryByRole('region', LIBRARY)).not.toBeInTheDocument()
    expect(document.documentElement.hasAttribute(OPEN_ATTR)).toBe(false)
  })

  it('closes the Export menu on Escape without closing the view', async () => {
    const root = await openLibraryFromSidebar()
    const view = inOverlay(root)
    fireEvent.click(view.getByRole('button', { name: 'Export' }))
    await nextFrame()
    expect(view.getByRole('menu')).toBeInTheDocument()
    typeInOverlay(root, 'Escape')
    await nextFrame()
    expect(view.queryByRole('menu')).not.toBeInTheDocument()
    expect(view.getByRole('region', LIBRARY)).toBeInTheDocument()
    expect(document.documentElement.hasAttribute(OPEN_ATTR)).toBe(true)
  })

  it('closes on Escape typed in the overlay when no menu is open', async () => {
    const root = await openLibraryFromSidebar()
    typeInOverlay(root, 'Escape')
    await nextFrame()
    expect(inOverlay(root).queryByRole('region', LIBRARY)).not.toBeInTheDocument()
  })

  it('checks the stale chats once the view opens', async () => {
    const api = installFakeChatGptApi()
    const background = installFakeBackground()
    background.answerWith((message) => {
      const type = fieldOf(message, 'type')
      if (type === 'conversations.list')
        return ok([makeConversation({ id: 'stale-chat', checkedAt: 0 })])
      return answerFor(type, EMPTY_SNAPSHOT)
    })
    await openLibraryFromSidebar()
    expect(api.checked()).toEqual(['stale-chat'])
  })

  it('opens from the toolbar command', async () => {
    const { root } = await startWithOverlay()
    await deliverMessage(LIBRARY_OPEN)
    await nextFrame()
    expect(inOverlay(root).getByRole('region', LIBRARY)).toBeInTheDocument()
  })

  it('takes its marks off the page when the context is invalidated', async () => {
    const { ctx } = await startWithOverlay()
    clickSidebarItem()
    await nextFrame()
    ctx.notifyInvalidated()
    expect(document.documentElement.hasAttribute(OPEN_ATTR)).toBe(false)
    expect(requireElement(MAIN).hasAttribute(INERT_ATTR)).toBe(false)
    expect(document.querySelector(`[${NAV_ATTR}]`)).toBeNull()
  })
})

describe('Highlights view over a conversation', () => {
  const answerWithHighlight = (): void => {
    const highlight = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
    const conversation = makeConversation({ id: FIXTURE_CONVERSATION_ID })
    installFakeBackground().answerWith((message) => {
      const type = fieldOf(message, 'type')
      if (type === 'conversation.load') return ok({ conversation, highlights: [highlight] })
      const snapshot = { conversations: [conversation], highlights: [highlight] }
      return answerFor(type, snapshot)
    })
  }

  beforeEach(() => {
    mountFixture(conversationHtml + sidebarHtml)
    installFakeResizeObserver()
    answerWithHighlight()
  })

  it('keeps the chat highlighted underneath while the address reads /#highlights', async () => {
    await openLibraryFromSidebar()
    expect(`${window.location.pathname}${window.location.hash}`).toBe(LIBRARY_ADDRESS)
    threadContainer().append(document.createElement('span'))
    await nextFrame()
    expect(countPaintedRanges(registry)).toBe(1)
  })

  it('counts a jump to a highlight of the chat underneath as the same chat', async () => {
    const link = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const scrollIntoView = installFakeScrollIntoView()
    const root = await openLibraryFromSidebar()
    threadContainer().append(document.createElement('span'))
    await nextFrame()
    fireEvent.click(inOverlay(root).getByRole('button', { name: new RegExp(PULL_QUOTE) }))
    await nextFrame()
    expect(inOverlay(root).queryByRole('region', LIBRARY)).not.toBeInTheDocument()
    expect(link).not.toHaveBeenCalled()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('leaves the highlight in view when going back restores the old scroll position', async () => {
    const scrolls: string[] = []
    installFakeScrollIntoView().mockImplementation(() => scrolls.push(SCROLLED_TO_HIGHLIGHT))
    window.addEventListener(
      'popstate',
      () => setTimeout(() => scrolls.push(SCROLL_RESTORED), RESTORE_DELAY_MS),
      { once: true },
    )
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), TRAVERSAL_MS)
    })
    const root = await openLibraryFromSidebar()
    threadContainer().append(document.createElement('span'))
    await nextFrame()
    fireEvent.click(inOverlay(root).getByRole('button', { name: new RegExp(PULL_QUOTE) }))
    await vi.advanceTimersByTimeAsync(TRAVERSAL_MS + RESTORE_DELAY_MS + FRAME_MS * 2)
    expect(scrolls.at(-1)).toBe(SCROLLED_TO_HIGHLIGHT)
  })

  it('puts the address back on the chat it jumped within', async () => {
    installFakeScrollIntoView()
    const root = await openLibraryFromSidebar()
    threadContainer().append(document.createElement('span'))
    await nextFrame()
    fireEvent.click(inOverlay(root).getByRole('button', { name: new RegExp(PULL_QUOTE) }))
    await nextFrame()
    expect(`${window.location.pathname}${window.location.hash}`).toBe(FIXTURE_CHAT_PATH)
  })
})
