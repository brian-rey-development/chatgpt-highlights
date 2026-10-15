import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPOSER_FORM, LIBRARY_HASH, MAIN, MESSAGE_UNIT, TEST_ID_ATTR, TURN } from '@/chatgpt'
import {
  addStopButton,
  appendAnsweredTurn,
  cloneElement,
  conversationHtml,
  FIXTURE_CHAT_PATH,
  FRAME_MS,
  mountFixture,
  NEW_ANSWER_ID,
  nextFrame,
  OTHER_CONVERSATION_ID,
  requireElement,
  requireText,
  swapMain,
  threadContainer,
} from '@/testing'
import type { Stop } from './listen'
import { createWatcher, type Flush } from './watcher'

const FIRST_PARAGRAPH = 'p'
const SEND_BUTTON_ID = 'send-button'

const stops: Stop[] = []
const onFlush = vi.fn<(flush: Flush) => void>()

const start = () => {
  const watcher = createWatcher(document, onFlush)
  stops.push(watcher.stop)
  return watcher
}

const lastFlush = (): Flush => {
  const flush = onFlush.mock.lastCall?.[0]
  if (!flush) throw new Error('nothing was flushed')
  return flush
}

const firstUnit = () => requireElement(MESSAGE_UNIT)

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', FIXTURE_CHAT_PATH)
  mountFixture(conversationHtml)
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

describe('createWatcher', () => {
  it('emits nothing on an idle page', async () => {
    start()
    await vi.advanceTimersByTimeAsync(FRAME_MS * 10)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('emits one flush per frame however many mutations arrive', async () => {
    start()
    const text = requireText(requireElement(FIRST_PARAGRAPH, firstUnit()))
    for (let index = 0; index < 30; index += 1) text.data = `streamed ${index}`
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('keeps a single frame across separate batches of mutations', async () => {
    start()
    const text = requireText(requireElement(FIRST_PARAGRAPH, firstUnit()))
    text.data = 'first batch'
    await Promise.resolve()
    text.data = 'second batch'
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('reports the unit a text change landed in', async () => {
    start()
    requireText(requireElement(FIRST_PARAGRAPH, firstUnit())).data = 'changed'
    await nextFrame()
    expect([...lastFlush().units]).toEqual([firstUnit()])
  })

  it('reports a unit once however many of its nodes changed', async () => {
    start()
    requireElement(FIRST_PARAGRAPH, firstUnit()).append(document.createElement('em'))
    requireText(requireElement(FIRST_PARAGRAPH, firstUnit())).data = 'changed'
    await nextFrame()
    expect(lastFlush().units.size).toBe(1)
  })

  it('reports the unit when a node inside it is hidden or shown to assistive tech', async () => {
    start()
    const paragraph = requireElement(FIRST_PARAGRAPH, firstUnit())
    paragraph.setAttribute('aria-hidden', 'true')
    await nextFrame()
    expect([...lastFlush().units]).toEqual([firstUnit()])
    paragraph.removeAttribute('aria-hidden')
    await nextFrame()
    expect([...lastFlush().units]).toEqual([firstUnit()])
  })

  it('stays quiet for attribute changes that cannot alter what a message says', async () => {
    start()
    requireElement(FIRST_PARAGRAPH, firstUnit()).className = 'restyled'
    await nextFrame()
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('reports a unit mounted inside a new turn', async () => {
    start()
    const added = appendAnsweredTurn(NEW_ANSWER_ID)
    await nextFrame()
    expect([...lastFlush().units]).toEqual([added])
  })

  it('reports a unit that replaced an identical one', async () => {
    start()
    const original = firstUnit()
    const replacement = cloneElement(original)
    original.replaceWith(replacement)
    await nextFrame()
    expect([...lastFlush().units]).toEqual([replacement])
  })

  it('flushes without units when an unrelated node was removed', async () => {
    start()
    requireElement(TURN).remove()
    await nextFrame()
    expect(lastFlush().units.size).toBe(0)
  })

  it('skips a node that was removed again before the frame', async () => {
    start()
    appendAnsweredTurn(NEW_ANSWER_ID).closest(TURN)?.remove()
    await nextFrame()
    expect(lastFlush().units.size).toBe(0)
  })

  it('reports a changed address on the first flush only until the address moves', async () => {
    const watcher = start()
    watcher.requestFull()
    await nextFrame()
    expect(lastFlush().addressChanged).toBe(true)
    watcher.requestFull()
    await nextFrame()
    expect(lastFlush().addressChanged).toBe(false)
    window.history.pushState(null, '', `/c/${OTHER_CONVERSATION_ID}`)
    watcher.requestFull()
    await nextFrame()
    expect(lastFlush().addressChanged).toBe(true)
  })

  it('reports an address that keeps its path and changes only its hash', async () => {
    const watcher = start()
    watcher.requestFull()
    await nextFrame()
    window.history.pushState(null, '', `${window.location.pathname}${LIBRARY_HASH}`)
    watcher.requestFull()
    await nextFrame()
    expect(lastFlush().addressChanged).toBe(true)
  })

  it('reports every mounted unit when a full flush is requested', async () => {
    start().requestFull()
    await nextFrame()
    expect(lastFlush().units.size).toBe(2)
  })

  it('reports only the units of the visible main when a full flush is requested', async () => {
    const { visible } = swapMain(conversationHtml)
    start().requestFull()
    await nextFrame()
    expect([...lastFlush().units].every((unit) => visible.contains(unit))).toBe(true)
    expect(lastFlush().units.size).toBe(2)
  })

  it('flushes without units when only text was added outside any unit', async () => {
    start()
    threadContainer().append(document.createTextNode('stray'))
    await nextFrame()
    expect(lastFlush().units.size).toBe(0)
  })

  it('stops quietly when no frame is pending', () => {
    start().stop()
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('stops flushing and cancels the pending frame', async () => {
    const watcher = start()
    requireText(requireElement(FIRST_PARAGRAPH, firstUnit())).data = 'changed'
    await Promise.resolve()
    watcher.stop()
    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    expect(onFlush).not.toHaveBeenCalled()
  })
})

describe('generation end', () => {
  it('flushes when the stop button leaves the composer', async () => {
    const stopButton = addStopButton()
    start()
    stopButton.remove()
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('flushes when the stop button turns into the send button in place', async () => {
    const stopButton = addStopButton()
    start()
    stopButton.setAttribute(TEST_ID_ATTR, SEND_BUTTON_ID)
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('does not flush for a change to an unrelated attribute of the composer', async () => {
    start()
    requireElement(COMPOSER_FORM).setAttribute('data-draft', 'true')
    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    expect(onFlush).not.toHaveBeenCalled()
  })
})

describe('thread root', () => {
  it('ignores changes outside the thread', async () => {
    const outside = document.createElement('aside')
    outside.textContent = 'sidebar'
    document.body.append(outside)
    start()
    requireText(outside).data = 'changed'
    outside.append(document.createElement('span'))
    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('falls back to the body when the page has no thread', async () => {
    mountFixture('<div id="app"></div>')
    start()
    requireElement('#app').append(document.createElement('p'))
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
  })

  it('follows the thread when its container is replaced', async () => {
    start()
    const replacement = cloneElement(threadContainer())
    threadContainer().replaceWith(replacement)
    await nextFrame()
    expect(lastFlush().units.size).toBe(2)
    onFlush.mockClear()
    requireText(requireElement(FIRST_PARAGRAPH, firstUnit())).data = 'changed'
    await nextFrame()
    expect([...lastFlush().units]).toEqual([firstUnit()])
  })

  it('follows the thread when main itself is replaced', async () => {
    start()
    requireElement(MAIN).replaceWith(cloneElement(requireElement(MAIN)))
    await nextFrame()
    expect(lastFlush().units.size).toBe(2)
    onFlush.mockClear()
    requireText(requireElement(FIRST_PARAGRAPH, firstUnit())).data = 'changed'
    await nextFrame()
    expect([...lastFlush().units]).toEqual([firstUnit()])
  })

  it('follows the visible main when the old one stays mounted but hidden', async () => {
    start()
    const { visible } = swapMain(conversationHtml)
    await nextFrame()
    onFlush.mockClear()
    const unit = requireElement(MESSAGE_UNIT, visible)
    requireText(requireElement(FIRST_PARAGRAPH, unit)).data = 'changed'
    await nextFrame()
    expect([...lastFlush().units]).toEqual([unit])
  })

  it('keeps watching a new main shown after a frame with no visible main', async () => {
    start()
    const { visible } = swapMain(conversationHtml)
    visible.hidden = true
    await nextFrame()
    visible.hidden = false
    onFlush.mockClear()
    const unit = requireElement(MESSAGE_UNIT, visible)
    requireText(requireElement(FIRST_PARAGRAPH, unit)).data = 'changed'
    await nextFrame()
    expect([...lastFlush().units]).toContain(unit)
  })

  it('narrows from the main pane to the thread once turns exist', async () => {
    const turn = cloneElement(requireElement(TURN))
    mountFixture('<main><form>draft</form></main>')
    start()
    const draft = requireText(requireElement(COMPOSER_FORM))
    draft.data = 'typed'
    await nextFrame()
    expect(onFlush).toHaveBeenCalledTimes(1)
    const thread = document.createElement('div')
    thread.append(turn)
    requireElement(MAIN).append(thread)
    await nextFrame()
    onFlush.mockClear()
    draft.data = 'typed again'
    await vi.advanceTimersByTimeAsync(FRAME_MS * 2)
    expect(onFlush).not.toHaveBeenCalled()
  })
})
