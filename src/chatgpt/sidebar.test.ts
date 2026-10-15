import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HIGHLIGHTER_ICON } from '@/model'
import {
  MAIN_NAV,
  mountFixture,
  OTHER_CONVERSATION_ID,
  RAIL_NAV,
  requireElement,
  sidebarHtml,
} from '@/testing'
import {
  ACTIVE_ATTR,
  DESTINATION_ATTR,
  LIBRARY_DESTINATION,
  NAV_ACTIVE,
  NAV_ACTIVE_CLASS,
  NAV_ATTR,
  OPEN_ATTR,
} from './selectors'
import { conversationLink, ensureSidebarItem, isItemShown, PAGE_STYLES } from './sidebar'

const noop = (): void => undefined
const MISSING_ID = '68ec1f00-0000-4000-8000-000000000009'

const visibleLibrary = (): HTMLElement =>
  requireElement<HTMLElement>(`${MAIN_NAV} ${LIBRARY_DESTINATION}`)

const activeLink = (): Element => requireElement(NAV_ACTIVE)

const ensured = (onOpen: () => void = noop): HTMLElement => {
  const item = ensureSidebarItem(document, onOpen)
  if (!item) throw new Error('no sidebar item')
  return item
}

beforeEach(() => {
  mountFixture(sidebarHtml)
})

describe('isItemShown', () => {
  it('is true for a connected item in a visible nav', () => {
    expect(isItemShown(ensured())).toBe(true)
  })

  it('is false without an item', () => {
    expect(isItemShown(null)).toBe(false)
  })

  it('is false for an item taken off the page', () => {
    const item = ensured()
    item.remove()
    expect(isItemShown(item)).toBe(false)
  })

  it('is false for an item whose nav is hidden', () => {
    const item = ensured()
    requireElement(MAIN_NAV).setAttribute('hidden', '')
    expect(isItemShown(item)).toBe(false)
  })
})

describe('ensureSidebarItem', () => {
  it('inserts a clone right after the visible library button', () => {
    const item = ensured()
    expect(visibleLibrary().nextElementSibling).toBe(item)
    expect(item).not.toBe(visibleLibrary())
  })

  it('relabels the clone and marks it as ours', () => {
    const item = ensured()
    expect(item.textContent).toBe('Highlights')
    expect(item.getAttribute('aria-label')).toBe('Highlights')
    expect(item.getAttribute(DESTINATION_ATTR)).toBe('hl:highlights')
    expect(item.hasAttribute(NAV_ATTR)).toBe(true)
  })

  it('swaps the icon for the highlighter and keeps the original sizing', () => {
    visibleLibrary().querySelector('svg')?.setAttribute('class', 'icon')
    const icon = requireElement('svg', ensured())
    expect(icon.getAttribute('class')).toBe('icon')
    const drawn = [...icon.querySelectorAll('path')].map((path) => path.getAttribute('d'))
    expect(drawn).toEqual(HIGHLIGHTER_ICON.paths)
    expect(icon.getAttribute('stroke')).toBe(HIGHLIGHTER_ICON.attributes.stroke)
    expect(ensured().querySelectorAll('svg')).toHaveLength(1)
  })

  it('drops id, aria-current and onboarding attributes from the clone', () => {
    const library = visibleLibrary()
    library.setAttribute('id', 'library-1')
    library.setAttribute(ACTIVE_ATTR, 'page')
    library.setAttribute('data-onboarding-id', 'library-tip')
    library.setAttribute('data-keep', 'yes')
    const item = ensured()
    expect(item.getAttributeNames().toSorted()).toEqual([
      'aria-label',
      'class',
      NAV_ATTR,
      'data-keep',
      DESTINATION_ATTR,
    ])
  })

  it('does not copy the active highlight class from the open library button', () => {
    visibleLibrary().classList.add(NAV_ACTIVE_CLASS)
    expect(ensured().classList.contains(NAV_ACTIVE_CLASS)).toBe(false)
  })

  it('removes extra text such as badges so only the label remains', () => {
    visibleLibrary().insertAdjacentHTML('beforeend', '<span>New</span>')
    expect(ensured().textContent).toBe('Highlights')
  })

  it('adds an icon when the source destination has none', () => {
    visibleLibrary().querySelector('svg')?.remove()
    expect(ensured().firstElementChild?.tagName.toLowerCase()).toBe('svg')
  })

  it('keeps an icon-only destination label-free but still named', () => {
    mountFixture(
      '<nav><button data-sidebar-destination="builtin:images"><svg></svg></button></nav>',
    )
    const item = ensured()
    expect(item.textContent).toBe('')
    expect(item.getAttribute('aria-label')).toBe('Highlights')
  })

  it('returns the same element on a second call', () => {
    const first = ensured()
    expect(ensured()).toBe(first)
    expect(document.querySelectorAll(`[${NAV_ATTR}]`)).toHaveLength(1)
  })

  it('moves the clone into the rail after the sidebar collapses', () => {
    const first = ensured()
    requireElement(MAIN_NAV).setAttribute('hidden', '')
    const rail = requireElement(RAIL_NAV)
    rail.removeAttribute('hidden')
    for (const button of rail.querySelectorAll('button')) button.removeAttribute('hidden')
    const second = ensured()
    expect(second).not.toBe(first)
    expect(second.parentElement).toBe(rail)
    expect(document.querySelectorAll(`[${NAV_ATTR}]`)).toHaveLength(1)
  })

  it('falls back to after the last visible destination without a library button', () => {
    visibleLibrary().remove()
    const skills = document.querySelector(`${MAIN_NAV} [data-sidebar-destination="builtin:skills"]`)
    expect(ensured().previousElementSibling).toBe(skills)
  })

  it('keeps a hidden clone while no destination is visible', () => {
    const first = ensured()
    requireElement(MAIN_NAV).setAttribute('hidden', '')
    expect(ensureSidebarItem(document, noop)).toBe(first)
    expect(first.isConnected).toBe(true)
  })

  it('returns null when no destination is visible', () => {
    mountFixture('<nav hidden><button data-sidebar-destination="builtin:library">x</button></nav>')
    expect(ensureSidebarItem(document, noop)).toBeNull()
  })

  it('ignores the hidden rail copies', () => {
    const rail = document.querySelector(RAIL_NAV)
    expect(ensured().parentElement).not.toBe(rail)
    expect(rail?.querySelector(`[${NAV_ATTR}]`)).toBeNull()
  })

  it('opens once and hides the click from ChatGPT', () => {
    const onOpen = vi.fn()
    const chatgptListener = vi.fn()
    document.body.addEventListener('click', chatgptListener)
    ensured(onOpen).querySelector('span')?.click()
    expect(onOpen).toHaveBeenCalledOnce()
    expect(chatgptListener).not.toHaveBeenCalled()
  })
})

describe('PAGE_STYLES', () => {
  const colorOf = (element: Element): string => getComputedStyle(element).backgroundColor

  beforeEach(() => {
    const style = document.createElement('style')
    style.textContent = PAGE_STYLES
    document.head.append(style)
    activeLink().setAttribute('style', 'background-color: red')
  })

  it('leaves ChatGPT styling alone while the view is closed', () => {
    const item = ensured()
    expect(colorOf(activeLink())).toBe('rgb(255, 0, 0)')
    expect(colorOf(item)).toBe('rgba(0, 0, 0, 0)')
  })

  it('shows the clone as active and clears the native active item while open', () => {
    const item = ensured()
    document.documentElement.setAttribute(OPEN_ATTR, '')
    expect(colorOf(activeLink())).toBe('rgba(0, 0, 0, 0)')
    expect(colorOf(item)).toBe('var(--color-background-primary-soft-hover)')
    document.documentElement.removeAttribute(OPEN_ATTR)
  })
})

const addHistoryLink = (href: string, label: string): void => {
  const link = document.createElement('a')
  link.setAttribute('data-interactive-row-link', '')
  link.setAttribute('href', href)
  link.textContent = label
  requireElement(MAIN_NAV).append(link)
}

describe('conversationLink', () => {
  it('finds a link inside a project, whose path has a prefix', () => {
    addHistoryLink(`/g/g-p-1/c/${MISSING_ID}`, 'Project chat')
    expect(conversationLink(document, MISSING_ID)?.textContent).toBe('Project chat')
  })

  it('finds a link that carries a query string', () => {
    addHistoryLink(`/c/${MISSING_ID}?model=x`, 'With query')
    expect(conversationLink(document, MISSING_ID)?.textContent).toBe('With query')
  })

  it('ignores a link whose path only ends with the id', () => {
    addHistoryLink(`/share/c/${MISSING_ID}`, 'Shared')
    expect(conversationLink(document, MISSING_ID)).toBeNull()
  })

  it('returns the history anchor for a conversation', () => {
    const link = conversationLink(document, OTHER_CONVERSATION_ID)
    expect(link?.textContent).toBe('Second chat')
  })

  it('returns null for an unknown conversation', () => {
    expect(conversationLink(document, 'missing')).toBeNull()
  })
})
