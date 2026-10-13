import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WRITE_FAILURE } from '@/testing'
import { createStore, type Store, showFailure, showMessage, showToast, TOAST_MS } from './store'

const TOAST = { message: 'Highlight removed', action: null }
const ONE_SECOND_MS = 1000

const shownMessage = (store: Store): string | undefined => store.toast.value?.message

describe('createStore', () => {
  it('starts empty', () => {
    const store = createStore()
    expect(store.conversationId.value).toBeNull()
    expect(store.conversation.value).toBeNull()
    expect(store.highlights.value.size).toBe(0)
    expect(store.orphanIds.value.size).toBe(0)
    expect(store.pill.value).toBeNull()
    expect(store.popover.value).toBeNull()
    expect(store.toast.value).toBeNull()
    expect(store.library.value).toBeNull()
    expect(store.libraryFrame.value).toBeNull()
  })

  it('keeps every store separate', () => {
    const first = createStore()
    const second = createStore()
    first.conversationId.value = 'conversation-1'
    expect(second.conversationId.value).toBeNull()
  })
})

describe('showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('shows the toast with an id', () => {
    const store = createStore()
    showToast(store, TOAST)
    expect(store.toast.value).toMatchObject(TOAST)
    expect(store.toast.value?.id).toBeGreaterThan(0)
  })

  it('gives every toast its own id so each one replays its entry', () => {
    const store = createStore()
    showToast(store, TOAST)
    const first = store.toast.value?.id
    showToast(store, TOAST)
    expect(store.toast.value?.id).not.toBe(first)
  })

  it('dismisses itself after six seconds', () => {
    const store = createStore()
    showToast(store, TOAST)
    vi.advanceTimersByTime(TOAST_MS - 1)
    expect(store.toast.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(store.toast.value).toBeNull()
  })

  it('lets a newer toast outlive the timer of the one it replaced', () => {
    const store = createStore()
    showToast(store, TOAST)
    vi.advanceTimersByTime(TOAST_MS - ONE_SECOND_MS)
    showToast(store, { message: 'Second', action: null })
    vi.advanceTimersByTime(ONE_SECOND_MS)
    expect(shownMessage(store)).toBe('Second')
    vi.advanceTimersByTime(TOAST_MS)
    expect(store.toast.value).toBeNull()
  })

  it('does not let the timer of a dismissed toast dismiss the next one', () => {
    const store = createStore()
    showToast(store, TOAST)
    store.toast.value = null
    showToast(store, { message: 'Later', action: null })
    vi.advanceTimersByTime(TOAST_MS - 1)
    expect(shownMessage(store)).toBe('Later')
  })
})

describe('showMessage', () => {
  it('shows a message with no action', () => {
    const store = createStore()
    showMessage(store, 'Copied as Markdown')
    expect(store.toast.value).toMatchObject({ message: 'Copied as Markdown', action: null })
  })
})

describe('showFailure', () => {
  it("shows the error's message", () => {
    const store = createStore()
    showFailure(store, WRITE_FAILURE)
    expect(store.toast.value).toMatchObject({ message: WRITE_FAILURE.message, action: null })
  })
})
