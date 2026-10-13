import { describe, expect, it } from 'vitest'
import {
  askBoxHtml,
  conversationHtml,
  FIRST_ANSWER_ID,
  LAST_ANSWER_ID,
  mountFixture,
  sidebarHtml,
} from '@/testing'
import {
  ASK_BOX,
  CODE_BLOCK,
  COMPOSER,
  COMPOSER_FORM,
  COPY_EXCLUDED,
  GENERATION_ATTRS,
  HISTORY_LINK,
  IGNORED_TEXT_SELECTOR,
  INERT_ATTR,
  LIBRARY_DESTINATION,
  MAIN,
  MARKDOWN_COPY_ATTR,
  MESSAGE_ID_ATTR,
  MESSAGE_UNIT,
  NAV_ACTIVE,
  NAV_ATTR,
  OPEN_ATTR,
  PAGE_STYLE_ID,
  SIDEBAR_DESTINATION,
  SIDEBAR_LINK,
  STOP_BUTTON,
  TEXT_ROOT,
  TURN,
  TURN_KEY_ATTR,
  TURN_MESSAGE_IDS_ATTR,
} from './selectors'

const STOP_BY_TEST_ID = '<button data-testid="stop-button"></button>'
const STOP_BY_LABEL = '<button aria-label="Stop streaming"></button>'
const GENERATING_FORM = `<form>${STOP_BY_TEST_ID}${STOP_BY_LABEL}</form>`

describe('selectors', () => {
  it.each([
    { name: 'MAIN', selector: MAIN, html: conversationHtml, count: 1 },
    { name: 'TURN', selector: TURN, html: conversationHtml, count: 4 },
    {
      name: 'TURN_KEY_ATTR',
      selector: `[${TURN_KEY_ATTR}="turn-4"]`,
      html: conversationHtml,
      count: 1,
    },
    {
      name: 'TURN_MESSAGE_IDS_ATTR',
      selector: `[${TURN_MESSAGE_IDS_ATTR}]`,
      html: conversationHtml,
      count: 4,
    },
    { name: 'MESSAGE_UNIT', selector: MESSAGE_UNIT, html: conversationHtml, count: 2 },
    { name: 'TEXT_ROOT', selector: TEXT_ROOT, html: conversationHtml, count: 2 },
    { name: 'COMPOSER', selector: COMPOSER, html: conversationHtml, count: 1 },
    { name: 'CODE_BLOCK', selector: CODE_BLOCK, html: conversationHtml, count: 1 },
    { name: 'COPY_EXCLUDED', selector: COPY_EXCLUDED, html: conversationHtml, count: 1 },
    { name: 'STOP_BUTTON idle', selector: STOP_BUTTON, html: conversationHtml, count: 0 },
    { name: 'STOP_BUTTON generating', selector: STOP_BUTTON, html: GENERATING_FORM, count: 2 },
    { name: 'ASK_BOX', selector: ASK_BOX, html: askBoxHtml, count: 1 },
    { name: 'SIDEBAR_DESTINATION', selector: SIDEBAR_DESTINATION, html: sidebarHtml, count: 5 },
    { name: 'LIBRARY_DESTINATION', selector: LIBRARY_DESTINATION, html: sidebarHtml, count: 2 },
    { name: 'NAV_ACTIVE', selector: NAV_ACTIVE, html: sidebarHtml, count: 1 },
    { name: 'HISTORY_LINK', selector: HISTORY_LINK, html: sidebarHtml, count: 2 },
    { name: 'SIDEBAR_LINK', selector: SIDEBAR_LINK, html: sidebarHtml, count: 7 },
  ])('$name matches the fixture', ({ selector, html, count }) => {
    mountFixture(html)
    expect(document.querySelectorAll(selector)).toHaveLength(count)
  })

  it('reads assistant message ids in document order', () => {
    mountFixture(conversationHtml)
    const ids = [...document.querySelectorAll(MESSAGE_UNIT)].map((unit) =>
      unit.getAttribute(MESSAGE_ID_ATTR),
    )
    expect(ids).toEqual([FIRST_ANSWER_ID, LAST_ANSWER_ID])
  })

  it('watches the attributes that turn the stop button into the send button', () => {
    expect(GENERATION_ATTRS).toEqual(['data-testid', 'aria-label'])
    mountFixture(GENERATING_FORM)
    expect(document.querySelectorAll(COMPOSER_FORM)).toHaveLength(1)
  })

  it('names the attributes and the style element the extension places in the page', () => {
    expect([NAV_ATTR, OPEN_ATTR, INERT_ATTR, PAGE_STYLE_ID]).toEqual([
      'data-hl-nav',
      'data-hl-open',
      'inert',
      'hl-page-styles',
    ])
  })

  it('places the text root inside the message unit', () => {
    mountFixture(conversationHtml)
    expect(document.querySelector(`${MESSAGE_UNIT} ${TEXT_ROOT}`)).not.toBeNull()
  })
})

describe('IGNORED_TEXT_SELECTOR', () => {
  it('matches the code header, buttons and katex mathml but keeps rendered glyphs', () => {
    mountFixture(conversationHtml)
    const matched = [...document.querySelectorAll(IGNORED_TEXT_SELECTOR)].map(
      (element) =>
        element.getAttribute(MARKDOWN_COPY_ATTR) ??
        element.getAttribute('class') ??
        element.tagName.toLowerCase(),
    )
    expect(matched).toEqual(['katex-mathml', 'exclude', 'svg', 'button', 'button'])
  })

  it.each([
    'button',
    'svg',
    '[aria-hidden="true"]:not(.katex-html)',
    '.katex-mathml',
    COPY_EXCLUDED,
    'script',
    'style',
  ])('lists %s', (part) => {
    expect(IGNORED_TEXT_SELECTOR.split(', ')).toContain(part)
  })
})
