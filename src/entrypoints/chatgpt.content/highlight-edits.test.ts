import { beforeEach, describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/errors'
import { fieldOf, type Highlight, type HighlightPatch, REMOVED_MESSAGE } from '@/model'
import { createPainter, type Painter } from '@/painter'
import {
  conversationHtml,
  type FakeBackground,
  FIRST_ANSWER_ID,
  FIXTURE_CONVERSATION_ID,
  highlightIn,
  installFakeBackground,
  installFakeHighlightApi,
  makeConversation,
  makeOverlayRoot,
  mountFixture,
  OTHER_CONVERSATION_ID,
  PULL_QUOTE,
  requireUnit,
  settle,
  WRITE_FAILURE,
} from '@/testing'
import { anchorUnits } from './anchor-pass'
import { editHighlight, removeHighlight, UNDO_LABEL } from './highlight-edits'
import { createStore, type Store } from './store'

const OVERLAY_RECT = new DOMRect(1, 2, 3, 4)

let painter: Painter
let store: Store
let background: FakeBackground
let saved: Highlight

const runtime = () => ({ doc: document, store, painter, shadowRoot: makeOverlayRoot() })

const seed = (highlight: Highlight): void => {
  store.highlights.value = new Map([[highlight.id, highlight]])
  anchorUnits({ store, painter }, [requireUnit(highlight.messageId)])
}

const stored = (): Highlight | undefined => store.highlights.value.get(saved.id)

const requestTypes = (): unknown[] => background.sent().map((message) => fieldOf(message, 'type'))

beforeEach(() => {
  vi.useFakeTimers()
  mountFixture(conversationHtml)
  painter = createPainter(installFakeHighlightApi())
  store = createStore()
  store.conversationId.value = FIXTURE_CONVERSATION_ID
  background = installFakeBackground()
  saved = highlightIn(FIRST_ANSWER_ID, PULL_QUOTE)
  seed(saved)
})

describe('editHighlight', () => {
  it('applies the patch and repaints before the background answers', async () => {
    const gate = background.hold()
    const edit = editHighlight(runtime(), saved.id, { color: 'blue', note: 'Why tides' })
    expect(stored()).toMatchObject({ color: 'blue', note: 'Why tides' })
    expect(painter.painted.get(saved.id)).toMatchObject({ color: 'blue', hasNote: true })
    gate.resolve(ok(saved))
    await edit
    expect(background.sent()).toEqual([
      { type: 'highlight.update', id: saved.id, patch: { color: 'blue', note: 'Why tides' } },
    ])
    expect(store.toast.value).toBeNull()
  })

  it('rolls back and shows the error when the write fails', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    await editHighlight(runtime(), saved.id, { color: 'pink', note: 'Draft', tags: ['tides'] })
    expect(stored()).toEqual(saved)
    expect(painter.painted.get(saved.id)).toMatchObject({ color: saved.color, hasNote: false })
    expect(store.toast.value?.message).toBe(WRITE_FAILURE.message)
  })

  it('rolls back only the fields of the failed patch', async () => {
    const colorGate = Promise.withResolvers<unknown>()
    background.answerWith((message) =>
      fieldOf(fieldOf(message, 'patch'), 'color') ? colorGate.promise : ok(saved),
    )
    const failed = editHighlight(runtime(), saved.id, { color: 'green' })
    await editHighlight(runtime(), saved.id, { note: 'Kept' })
    colorGate.resolve(err(WRITE_FAILURE))
    await failed
    expect(stored()).toMatchObject({ color: saved.color, note: 'Kept' })
  })

  it.each<{ name: string; patch: HighlightPatch }>([
    { name: 'the tags', patch: { tags: ['moon'] } },
    { name: 'the note', patch: { note: 'Why' } },
  ])('rolls back $name of a failed patch', async ({ patch }) => {
    background.answerWith(() => err(WRITE_FAILURE))
    await editHighlight(runtime(), saved.id, patch)
    expect(stored()).toEqual(saved)
  })

  it('keeps a newer successful edit when an older one fails afterwards', async () => {
    const older = Promise.withResolvers<unknown>()
    background.answerWith((message) =>
      fieldOf(fieldOf(message, 'patch'), 'note') === 'a' ? older.promise : ok(saved),
    )
    const failed = editHighlight(runtime(), saved.id, { note: 'a' })
    await editHighlight(runtime(), saved.id, { note: 'ab' })
    older.resolve(err(WRITE_FAILURE))
    await failed
    expect(stored()?.note).toBe('ab')
    expect(painter.painted.get(saved.id)).toMatchObject({ hasNote: true })
  })

  it('still saves an edit for a highlight the user just navigated away from', async () => {
    store.highlights.value = new Map()
    background.answerWith(() => ok(saved))
    await editHighlight(runtime(), saved.id, { note: 'Typed last' })
    expect(background.sent()).toEqual([
      { type: 'highlight.update', id: saved.id, patch: { note: 'Typed last' } },
    ])
    expect(store.toast.value).toBeNull()
  })

  it('shows the error when an edit for an unknown highlight cannot be saved', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    await editHighlight(runtime(), 'missing', { color: 'blue' })
    expect(store.highlights.value.size).toBe(1)
    expect(store.toast.value?.message).toBe(WRITE_FAILURE.message)
  })

  it('does not bring back a highlight that was removed while the write was in flight', async () => {
    const gate = background.hold()
    const edit = editHighlight(runtime(), saved.id, { color: 'blue' })
    store.highlights.value = new Map()
    gate.resolve(err(WRITE_FAILURE))
    await edit
    expect(stored()).toBeUndefined()
  })
})

describe('editHighlight with the popover open', () => {
  beforeEach(() => {
    background.answerWith(() => err(WRITE_FAILURE))
  })

  it('puts a failed recolor back in the open popover', async () => {
    store.popover.value = { highlight: saved, anchor: OVERLAY_RECT }
    await editHighlight(runtime(), saved.id, { color: 'purple' })
    expect(store.popover.value).toEqual({ highlight: saved, anchor: OVERLAY_RECT })
    expect(store.popover.value?.highlight).not.toBe(saved)
  })

  it('keeps the popover as it is when the failed edit was superseded', async () => {
    const popover = { highlight: saved, anchor: OVERLAY_RECT }
    store.popover.value = popover
    const gate = background.hold()
    const failed = editHighlight(runtime(), saved.id, { color: 'purple' })
    store.highlights.value = new Map([[saved.id, { ...saved, color: 'blue' }]])
    gate.resolve(err(WRITE_FAILURE))
    await failed
    expect(store.popover.value).toBe(popover)
  })

  it('leaves the popover of another highlight alone', async () => {
    const popover = { highlight: { ...saved, id: 'other' }, anchor: OVERLAY_RECT }
    store.popover.value = popover
    await editHighlight(runtime(), saved.id, { color: 'purple' })
    expect(store.popover.value).toBe(popover)
  })
})

describe('removeHighlight', () => {
  it('unpaints at once and forgets the highlight', async () => {
    const gate = background.hold()
    const removal = removeHighlight(runtime(), saved.id)
    expect(painter.painted.has(saved.id)).toBe(false)
    expect(stored()).toBeUndefined()
    gate.resolve(err(WRITE_FAILURE))
    await removal
  })

  it('closes the popover of the removed highlight', async () => {
    store.popover.value = { highlight: saved, anchor: OVERLAY_RECT }
    background.answerWith(() => err(WRITE_FAILURE))
    await removeHighlight(runtime(), saved.id)
    expect(store.popover.value).toBeNull()
  })

  it('leaves the popover of another highlight open', async () => {
    const other = { ...saved, id: 'other' }
    store.popover.value = { highlight: other, anchor: OVERLAY_RECT }
    background.answerWith(() => err(WRITE_FAILURE))
    await removeHighlight(runtime(), saved.id)
    expect(store.popover.value?.highlight.id).toBe('other')
  })

  it('offers Undo in a toast once the background deleted it', async () => {
    const deleted = { highlight: saved, conversation: makeConversation() }
    background.answerWith(() => ok(deleted))
    await removeHighlight(runtime(), saved.id)
    expect(background.sent()).toEqual([{ type: 'highlight.delete', id: saved.id }])
    expect(store.toast.value?.message).toBe(REMOVED_MESSAGE)
    expect(store.toast.value?.action?.label).toBe(UNDO_LABEL)
  })

  it('restores and repaints the highlight when Undo is chosen', async () => {
    const deleted = { highlight: saved, conversation: makeConversation() }
    background.answerWith((message) =>
      fieldOf(message, 'type') === 'highlight.delete' ? ok(deleted) : ok(saved),
    )
    await removeHighlight(runtime(), saved.id)
    store.toast.value?.action?.run()
    await settle()
    expect(background.sent('highlight.restore')).toEqual([{ type: 'highlight.restore', deleted }])
    expect(stored()).toEqual(saved)
    expect(painter.painted.get(saved.id)?.range.toString()).toBe(PULL_QUOTE)
  })

  it('keeps an undone highlight for later when its message is not on the page', async () => {
    const deleted = { highlight: saved, conversation: makeConversation() }
    background.answerWith((message) =>
      fieldOf(message, 'type') === 'highlight.delete' ? ok(deleted) : ok(saved),
    )
    await removeHighlight(runtime(), saved.id)
    requireUnit(FIRST_ANSWER_ID).element.remove()
    store.toast.value?.action?.run()
    await settle()
    expect(stored()).toEqual(saved)
    expect(painter.painted.has(saved.id)).toBe(false)
  })

  it('shows the error when Undo fails', async () => {
    const deleted = { highlight: saved, conversation: makeConversation() }
    background.answerWith((message) =>
      fieldOf(message, 'type') === 'highlight.delete' ? ok(deleted) : err(WRITE_FAILURE),
    )
    await removeHighlight(runtime(), saved.id)
    store.toast.value?.action?.run()
    await settle()
    expect(store.toast.value?.message).toBe(WRITE_FAILURE.message)
    expect(stored()).toBeUndefined()
  })

  it('does not add an undone highlight to a conversation the user has left', async () => {
    const deleted = { highlight: saved, conversation: makeConversation() }
    background.answerWith((message) =>
      fieldOf(message, 'type') === 'highlight.delete' ? ok(deleted) : ok(saved),
    )
    await removeHighlight(runtime(), saved.id)
    store.conversationId.value = OTHER_CONVERSATION_ID
    store.toast.value?.action?.run()
    await settle()
    expect(stored()).toBeUndefined()
  })

  it('puts the highlight back and shows the error when the delete fails', async () => {
    background.answerWith(() => err(WRITE_FAILURE))
    await removeHighlight(runtime(), saved.id)
    expect(stored()).toEqual(saved)
    expect(painter.painted.get(saved.id)?.range.toString()).toBe(PULL_QUOTE)
    expect(store.toast.value).toMatchObject({ message: WRITE_FAILURE.message, action: null })
  })

  it('ignores a highlight the conversation does not have', async () => {
    await removeHighlight(runtime(), 'missing')
    expect(requestTypes()).toEqual([])
  })
})
