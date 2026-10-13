import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  askBoxHtml,
  conversationHtml,
  homeHtml,
  installFakeClipboard,
  mountFixture,
  rangeOver,
  requireElement,
  requireText,
  settle,
  stubElementBox,
  swapMain,
} from '@/testing'
import { askAbout, NATIVE_WAIT_MS, NEAR_DISTANCE_PX, nativeAskBox, pasteQuote } from './ask'
import { CODE_BLOCK, COMPOSER, COMPOSER_FORM, TEXT_ROOT } from './selectors'

const SELECTION_RECT = new DOMRect(120, 100, 280, 20)
const BOX_RECT = new DOMRect(120, 64, 100, 30)
const FIRST_PARAGRAPH = `${TEXT_ROOT} p`

const selectionAround = (target: Element): Range => {
  const range = rangeOver(target)
  range.getBoundingClientRect = () => SELECTION_RECT
  return range
}

const events: string[] = []
const pastes: string[] = []
const selectedAtClick: string[] = []

const recordEvents = (): void => {
  const paragraph = requireElement(FIRST_PARAGRAPH)
  for (const type of ['pointerup', 'mouseup']) {
    paragraph.addEventListener(type, () => events.push(type))
  }
  document.querySelector('.fixed button')?.addEventListener('click', () => {
    events.push('click')
    selectedAtClick.push(document.getSelection()?.getRangeAt(0).toString() ?? '')
  })
  requireElement(COMPOSER).addEventListener('paste', (event) => {
    if (!(event instanceof ClipboardEvent)) return
    events.push('paste')
    pastes.push(event.clipboardData?.getData('text/plain') ?? '')
  })
}

const mountChat = (withAskBox: boolean): void => {
  mountFixture(withAskBox ? conversationHtml + askBoxHtml : conversationHtml)
  recordEvents()
}

beforeEach(() => {
  events.length = 0
  pastes.length = 0
  selectedAtClick.length = 0
  installFakeClipboard()
  stubElementBox(BOX_RECT)
})

describe('nativeAskBox', () => {
  beforeEach(() => mountFixture(askBoxHtml))

  it('finds a visible box near the selection', () => {
    expect(nativeAskBox(document, SELECTION_RECT)).toBe(requireElement('[role="presentation"]'))
  })

  it.each([
    {
      name: 'exactly the near distance below',
      top: BOX_RECT.bottom + NEAR_DISTANCE_PX,
      found: true,
    },
    { name: 'one pixel past it below', top: BOX_RECT.bottom + NEAR_DISTANCE_PX + 1, found: false },
    { name: 'overlapping', top: 80, found: true },
  ])('treats a selection $name the box', ({ top, found }) => {
    const near = new DOMRect(120, top, 280, 20)
    expect(nativeAskBox(document, near) !== null).toBe(found)
  })

  it.each([
    { name: '50 px to the right', left: 270, found: true },
    { name: '180 px to the right', left: 400, found: false },
  ])('measures the gap sideways for a selection $name', ({ left, found }) => {
    const near = new DOMRect(left, 64, 70, 30)
    expect(nativeAskBox(document, near) !== null).toBe(found)
  })

  it.each([
    { name: 'hidden by display', style: 'display: none' },
    { name: 'hidden by visibility', style: 'visibility: hidden' },
  ])('ignores a box $name', ({ style }) => {
    requireElement('[role="presentation"]').setAttribute('style', style)
    expect(nativeAskBox(document, SELECTION_RECT)).toBeNull()
  })

  it('ignores a box inside a hidden ancestor', () => {
    requireElement('.fixed').setAttribute('hidden', '')
    expect(nativeAskBox(document, SELECTION_RECT)).toBeNull()
  })

  it('ignores a presentation container that holds several buttons', () => {
    requireElement('[role="presentation"]').insertAdjacentHTML(
      'beforeend',
      '<button>Other</button>',
    )
    expect(nativeAskBox(document, SELECTION_RECT)).toBeNull()
  })

  it('returns null when there is no box', () => {
    mountFixture('<p>nothing</p>')
    expect(nativeAskBox(document, SELECTION_RECT)).toBeNull()
  })
})

describe('askAbout with the native box present', () => {
  beforeEach(() => mountChat(true))

  it('selects the range, releases the pointer, clicks Ask and pastes the note', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const result = await askAbout(document, { range, note: 'Check this' })
    expect(result).toBe('native')
    expect(selectedAtClick).toEqual([range.toString()])
    expect(events).toEqual(['pointerup', 'mouseup', 'click', 'paste'])
    expect(pastes).toEqual(['Check this'])
  })

  it('does not paste when the note is empty', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    await expect(askAbout(document, { range, note: '' })).resolves.toBe('native')
    expect(events).toEqual(['pointerup', 'mouseup', 'click'])
  })

  it('reports failure when the note cannot reach the missing composer', async () => {
    requireElement(COMPOSER_FORM).remove()
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    await expect(askAbout(document, { range, note: 'x' })).resolves.toBe('failed')
    expect(events).toContain('click')
  })

  it('releases the pointer on the element holding a range inside one text node', async () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    const text = requireText(paragraph)
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    range.getBoundingClientRect = () => SELECTION_RECT
    await askAbout(document, { range, note: '' })
    expect(events.slice(0, 2)).toEqual(['pointerup', 'mouseup'])
  })

  it('releases the pointer on the body for a range spanning the whole document', async () => {
    const released: string[] = []
    document.body.addEventListener('pointerup', () => released.push('pointerup'))
    const range = rangeOver(document)
    range.getBoundingClientRect = () => SELECTION_RECT
    await askAbout(document, { range, note: '' })
    expect(released).toEqual(['pointerup'])
  })

  it('replaces an earlier selection', async () => {
    document.getSelection()?.selectAllChildren(requireElement('h4'))
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    await askAbout(document, { range, note: '' })
    expect(document.getSelection()?.rangeCount).toBe(1)
  })
})

describe('askAbout waiting for the native box', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mountChat(false)
  })

  it('clicks the box when it appears within the wait and stops waiting', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const pending = askAbout(document, { range, note: '' })
    await vi.advanceTimersByTimeAsync(100)
    document.body.insertAdjacentHTML('beforeend', askBoxHtml)
    document.querySelector('.fixed button')?.addEventListener('click', () => {
      events.push('click')
      selectedAtClick.push(document.getSelection()?.getRangeAt(0).toString() ?? '')
    })
    await settle()
    await expect(pending).resolves.toBe('native')
    expect(events).toContain('click')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps waiting through unrelated page changes', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const pending = askAbout(document, { range, note: '' })
    document.body.insertAdjacentHTML('beforeend', '<div id="noise"></div>')
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS - 1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBe('pasted')
  })

  it('pastes the quote lines and the note after the wait without a native box', async () => {
    const paragraph = requireElement(FIRST_PARAGRAPH)
    paragraph.textContent = 'first line\nsecond line'
    const range = selectionAround(paragraph)
    const pending = askAbout(document, { range, note: 'my note' })
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS)
    await expect(pending).resolves.toBe('pasted')
    expect(pastes).toEqual(['> first line\n> second line\n\nmy note'])
    expect(events).toEqual(['pointerup', 'mouseup', 'paste'])
  })

  it('pastes only the quote when there is no note', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const pending = askAbout(document, { range, note: '' })
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS)
    await pending
    expect(pastes).toEqual([
      '> Tides come from the gravitational pull of the moon and the sun.\n\n',
    ])
  })

  it.each([
    {
      name: 'leaves out the code header with its language label and copy button',
      selector: CODE_BLOCK,
      quote: '> ratio = moon / sun',
    },
    {
      name: 'keeps one rendering of a formula',
      selector: `${TEXT_ROOT} p:nth-of-type(2)`,
      quote: '> The force scales as F over distance cubed.',
    },
  ])('$name in the pasted quote', async ({ selector, quote }) => {
    const range = selectionAround(requireElement(selector))
    const pending = askAbout(document, { range, note: 'note' })
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS)
    await pending
    expect(pastes).toEqual([`${quote}\n\nnote`])
  })

  it('reads the selection rectangle once and ignores unrelated attribute writes', async () => {
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const measure = vi.spyOn(range, 'getBoundingClientRect')
    const pending = askAbout(document, { range, note: '' })
    document.body.setAttribute('data-streaming', 'true')
    await settle()
    expect(measure).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS)
    await pending
  })

  it('notices a hidden box being revealed through its style', async () => {
    document.body.insertAdjacentHTML('beforeend', askBoxHtml)
    const box = requireElement('[role="presentation"]')
    box.setAttribute('style', 'display: none')
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const pending = askAbout(document, { range, note: '' })
    await vi.advanceTimersByTimeAsync(100)
    box.removeAttribute('style')
    await settle()
    await expect(pending).resolves.toBe('native')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fails when there is no composer', async () => {
    requireElement(COMPOSER_FORM).remove()
    const range = selectionAround(requireElement(FIRST_PARAGRAPH))
    const pending = askAbout(document, { range, note: 'x' })
    await vi.advanceTimersByTimeAsync(NATIVE_WAIT_MS)
    await expect(pending).resolves.toBe('failed')
  })
})

describe('pasteQuote', () => {
  beforeEach(() => mountChat(false))

  it('pastes the quote lines and the note into the composer', () => {
    expect(pasteQuote(document, { quote: 'first line\nsecond line', note: 'my note' })).toBe(
      'pasted',
    )
    expect(pastes).toEqual(['> first line\n> second line\n\nmy note'])
  })

  it('pastes into the composer of the visible main, not the hidden one', () => {
    const { visible } = swapMain(homeHtml)
    const visiblePastes: Event[] = []
    requireElement(COMPOSER, visible).addEventListener('paste', (event) =>
      visiblePastes.push(event),
    )
    pasteQuote(document, { quote: 'q', note: 'n' })
    expect(visiblePastes).toHaveLength(1)
    expect(pastes).toEqual([])
  })

  it('fails when there is no composer', () => {
    requireElement(COMPOSER_FORM).remove()
    expect(pasteQuote(document, { quote: 'q', note: '' })).toBe('failed')
    expect(pastes).toEqual([])
  })
})
