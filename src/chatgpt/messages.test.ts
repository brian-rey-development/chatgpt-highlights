import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addStopButton,
  conversationHtml,
  FIRST_ANSWER_ID,
  homeHtml,
  installFakeScrollIntoView,
  LAST_ANSWER_ID,
  mountFixture,
  requireElement,
  requireText,
  swapMain,
} from '@/testing'
import {
  CENTERED_SCROLL,
  composerForm,
  conversationTitle,
  findUnit,
  isGenerating,
  mainPane,
  scrollToMessage,
  threadRoot,
  unitElementOf,
  unitElements,
  unitOf,
} from './messages'
import {
  COMPOSER_FORM,
  MAIN,
  MESSAGE_UNIT,
  TEXT_ROOT,
  TURN,
  TURN_KEY_ATTR,
  TURN_MESSAGE_IDS_ATTR,
} from './selectors'

const UNMOUNTED_ANSWER_ID = 'assistant-2'

let scrollIntoView: ReturnType<typeof installFakeScrollIntoView>

const FIRST_PARAGRAPH = `${TEXT_ROOT} p`

beforeEach(() => {
  scrollIntoView = installFakeScrollIntoView()
  mountFixture(conversationHtml)
})

describe('unitOf', () => {
  it('resolves a deep text node to its message unit and text root', () => {
    const unit = unitOf(requireText(requireElement(FIRST_PARAGRAPH)))
    expect(unit?.messageId).toBe(FIRST_ANSWER_ID)
    expect(unit?.element).toBe(requireElement(MESSAGE_UNIT))
    expect(unit?.textRoot).toBe(requireElement(TEXT_ROOT))
  })

  it('resolves an element node too', () => {
    expect(unitOf(requireElement('strong'))?.messageId).toBe(FIRST_ANSWER_ID)
  })

  it('returns null for a node outside any unit', () => {
    expect(unitOf(requireElement('[data-user-message-bubble]'))).toBeNull()
    expect(unitOf(document.createTextNode('detached'))).toBeNull()
  })

  it('returns null for a unit without a text root', () => {
    mountFixture('<div data-chatgpt-selection-message-id="m1"><p>x</p></div>')
    expect(unitOf(requireElement('p'))).toBeNull()
  })

  it('returns null for a unit with an empty id', () => {
    mountFixture(`
      <div data-chatgpt-selection-message-id="">
        <div data-markdown-text-style=""><p>x</p></div>
      </div>`)
    expect(unitOf(requireElement('p'))).toBeNull()
  })
})

describe('unitElementOf', () => {
  it('resolves a text node and an element node to their unit element', () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    expect(unitElementOf(requireText(paragraph))).toBe(requireElement(MESSAGE_UNIT))
    expect(unitElementOf(requireElement('strong'))).toBe(requireElement(MESSAGE_UNIT))
  })

  it('returns the unit itself for the unit element', () => {
    expect(unitElementOf(requireElement(MESSAGE_UNIT))).toBe(requireElement(MESSAGE_UNIT))
  })

  it('returns null outside any unit, with or without a text root', () => {
    expect(unitElementOf(requireElement('[data-user-message-bubble]'))).toBeNull()
    expect(unitElementOf(document.createTextNode('detached'))).toBeNull()
    mountFixture('<div data-chatgpt-selection-message-id="m1"><p>x</p></div>')
    expect(unitElementOf(requireElement('p'))).toBe(requireElement(MESSAGE_UNIT))
  })
})

describe('findUnit', () => {
  it('finds a unit by id', () => {
    expect(findUnit(document, LAST_ANSWER_ID)?.messageId).toBe(LAST_ANSWER_ID)
  })

  it('returns null for an unknown id', () => {
    expect(findUnit(document, 'nope')).toBeNull()
  })

  it('finds a unit whose id contains a double quote', () => {
    mountFixture(`
      <div data-chatgpt-selection-message-id='say "hi"'>
        <div data-markdown-text-style=""><p>x</p></div>
      </div>`)
    expect(findUnit(document, 'say "hi"')?.messageId).toBe('say "hi"')
  })

  it('leaves out a unit whose text has not rendered yet', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-chatgpt-selection-message-id="streaming"></div>',
    )
    expect(findUnit(document, 'streaming')).toBeNull()
  })
})

describe('scrollToMessage', () => {
  it('scrolls the unit when it is mounted', () => {
    expect(scrollToMessage(document, LAST_ANSWER_ID)).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(scrollIntoView).toHaveBeenCalledWith(CENTERED_SCROLL)
    expect(scrollIntoView.mock.contexts[0]).toBe(findUnit(document, LAST_ANSWER_ID)?.element)
  })

  it('scrolls the turn that lists the message when the unit is not mounted', () => {
    expect(scrollToMessage(document, UNMOUNTED_ANSWER_ID)).toBe(true)
    expect(scrollIntoView.mock.contexts[0]).toBe(requireElement(`[${TURN_KEY_ATTR}="turn-3"]`))
  })

  it('finds the message among several ids on one turn', () => {
    requireElement(`[${TURN_KEY_ATTR}="turn-3"] [${TURN_MESSAGE_IDS_ATTR}]`).setAttribute(
      TURN_MESSAGE_IDS_ATTR,
      `a-1, ${UNMOUNTED_ANSWER_ID} a-3`,
    )
    expect(scrollToMessage(document, UNMOUNTED_ANSWER_ID)).toBe(true)
  })

  it('scrolls the ids element itself when no turn surrounds it', () => {
    mountFixture('<div data-chatgpt-search-message-ids="m1"></div>')
    expect(scrollToMessage(document, 'm1')).toBe(true)
    expect(scrollIntoView.mock.contexts[0]).toBe(requireElement('div'))
  })

  it('returns false when neither the unit nor a turn exists', () => {
    expect(scrollToMessage(document, 'missing')).toBe(false)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('composerForm', () => {
  it('returns the form around the composer', () => {
    expect(composerForm(document)).toBe(requireElement(COMPOSER_FORM))
  })

  it('finds the composer form without searching the whole document', () => {
    const form = requireElement(COMPOSER_FORM)
    const search = vi.spyOn(document, 'querySelector')
    expect(composerForm(document)).toBe(form)
    expect(search).not.toHaveBeenCalled()
  })

  it('returns null without a composer', () => {
    mountFixture('<form><input /></form>')
    expect(composerForm(document)).toBeNull()
  })
})

describe('page state', () => {
  it('follows the stop button', () => {
    expect(isGenerating(document)).toBe(false)
    addStopButton()
    expect(isGenerating(document)).toBe(true)
  })

  it('ignores a stop button outside the composer form', () => {
    requireElement(MAIN).insertAdjacentHTML(
      'beforeend',
      '<button aria-label="Stop sharing"></button>',
    )
    expect(isGenerating(document)).toBe(false)
  })

  it('ignores a stop button in a form without the composer', () => {
    mountFixture('<form><button data-testid="stop-button"></button></form>')
    expect(isGenerating(document)).toBe(false)
  })

  it.each([
    { name: 'a real title', title: 'Tides', expected: 'Tides' },
    { name: 'a padded title', title: '  Tides  ', expected: 'Tides' },
    { name: 'the bare product name', title: 'ChatGPT', expected: 'Untitled chat' },
    { name: 'an empty title', title: '', expected: 'Untitled chat' },
  ])('titles a chat from $name', ({ title, expected }) => {
    document.title = title
    expect(conversationTitle(document)).toBe(expected)
  })

  it('finds the main pane and the container that holds the turns', () => {
    expect(mainPane(document)).toBe(requireElement(MAIN))
    expect(threadRoot(document)).toBe(requireElement(TURN).parentElement)
  })

  it('falls back to the main pane without turns, then to null', () => {
    for (const turn of document.querySelectorAll(TURN)) turn.remove()
    expect(threadRoot(document)).toBe(requireElement(MAIN))
    mountFixture('')
    expect(threadRoot(document)).toBeNull()
    expect(mainPane(document)).toBeNull()
  })
})

describe('after an in-app navigation leaves the old main hidden', () => {
  it('resolves the main pane to the visible main', () => {
    const { visible } = swapMain(homeHtml)
    expect(mainPane(document)).toBe(visible)
  })

  it('resolves no main pane while none is visible', () => {
    swapMain(homeHtml).visible.hidden = true
    expect(mainPane(document)).toBeNull()
  })

  it('takes the composer form of the visible main', () => {
    const { visible } = swapMain(homeHtml)
    expect(composerForm(document)).toBe(requireElement(COMPOSER_FORM, visible))
  })

  it('takes a visible composer form when the page has no main', () => {
    const formHtml = requireElement(COMPOSER_FORM).outerHTML
    mountFixture(`<div hidden>${formHtml}</div>${formHtml}`)
    expect(composerForm(document)).toBe(document.body.lastElementChild)
  })

  it('ignores a stop button in the hidden main', () => {
    swapMain(homeHtml)
    addStopButton()
    expect(isGenerating(document)).toBe(false)
  })

  it('sees a stop button in the visible main', () => {
    const { visible } = swapMain(homeHtml)
    addStopButton(visible)
    expect(isGenerating(document)).toBe(true)
  })

  it('finds the thread root inside the visible main', () => {
    const { visible } = swapMain(conversationHtml)
    expect(threadRoot(document)).toBe(requireElement(TURN, visible).parentElement)
  })

  it('resolves no thread root while no main is visible', () => {
    swapMain(conversationHtml).visible.hidden = true
    expect(threadRoot(document)).toBeNull()
  })

  it('falls back to the visible main when it holds no turns', () => {
    const { visible } = swapMain(homeHtml)
    expect(threadRoot(document)).toBe(visible)
  })

  it('finds only the units of the visible main', () => {
    const { visible } = swapMain(conversationHtml)
    const unit = findUnit(document, FIRST_ANSWER_ID)?.element
    expect(unit).toBe(requireElement(MESSAGE_UNIT, visible))
    expect([...unitElements(document)].every((element) => visible.contains(element))).toBe(true)
  })

  it('finds no unit that only the hidden main holds', () => {
    swapMain(homeHtml)
    expect(findUnit(document, FIRST_ANSWER_ID)).toBeNull()
    expect(unitElements(document)).toHaveLength(0)
  })

  it('scrolls the unit of the visible main', () => {
    const { visible } = swapMain(conversationHtml)
    const unit = findUnit(document, LAST_ANSWER_ID)?.element
    scrollToMessage(document, LAST_ANSWER_ID)
    expect(scrollIntoView.mock.contexts[0]).toBe(unit)
    expect(visible.contains(unit ?? null)).toBe(true)
  })

  it('does not scroll to a turn that only the hidden main lists', () => {
    swapMain(homeHtml)
    expect(scrollToMessage(document, UNMOUNTED_ANSWER_ID)).toBe(false)
  })
})
