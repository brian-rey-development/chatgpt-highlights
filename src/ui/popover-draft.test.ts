import { act, renderHook } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import type { Highlight } from '@/model'
import { fakeActions, makeHighlight } from '@/testing'
import { NOTE_AUTOSAVE_MS } from './note-autosave'
import { usePopoverDraft } from './popover-draft'

const ANCHOR = new DOMRect(0, 0, 10, 10)

const setup = () => {
  const actions = fakeActions()
  const highlight = makeHighlight({ id: 'h1', color: 'blue', tags: ['a'], note: 'n' })
  const hook = renderHook(
    (model: Highlight) => usePopoverDraft({ highlight: model, anchor: ANCHOR }, actions),
    { initialProps: highlight },
  )
  return { actions, highlight, ...hook }
}

describe('usePopoverDraft', () => {
  it('starts from the stored highlight', () => {
    const { result } = setup()
    expect(result.current.color).toBe('blue')
    expect(result.current.tags).toEqual(['a'])
    expect(result.current.note.value).toBe('n')
  })

  it('reports a recolor once and reflects it at once', () => {
    const { result, actions } = setup()
    act(() => result.current.pickColor('pink'))
    act(() => result.current.pickColor('pink'))
    expect(result.current.color).toBe('pink')
    expect(actions.updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { color: 'pink' })
  })

  it('hands askAbout the draft, not the stored highlight', () => {
    const { result, actions, highlight } = setup()
    act(() => result.current.pickColor('green'))
    act(() => result.current.changeTags(['a', 'b']))
    act(() => result.current.ask())
    expect(actions.askAbout).toHaveBeenCalledExactlyOnceWith({
      ...highlight,
      color: 'green',
      tags: ['a', 'b'],
    })
  })

  it('saves the pending note before it closes the popover', () => {
    const { result, actions } = setup()
    act(() => result.current.note.edit('typed last'))
    act(() => result.current.close())
    expect(actions.updateHighlight).toHaveBeenCalledExactlyOnceWith('h1', { note: 'typed last' })
    expect(actions.closePopover).toHaveBeenCalledOnce()
    const [saved] = vi.mocked(actions.updateHighlight).mock.invocationCallOrder
    const [closed] = vi.mocked(actions.closePopover).mock.invocationCallOrder
    expect(saved).toBeLessThan(closed ?? 0)
  })

  it('removes the highlight by id', () => {
    const { result, actions } = setup()
    act(() => result.current.remove())
    expect(actions.removeHighlight).toHaveBeenCalledExactlyOnceWith('h1')
  })

  it('follows the model when its color and tags are put back', () => {
    const { result, rerender, highlight } = setup()
    act(() => result.current.pickColor('pink'))
    act(() => result.current.changeTags(['a', 'b']))
    rerender({ ...highlight })
    expect(result.current.color).toBe('blue')
    expect(result.current.tags).toEqual(['a'])
  })

  it('saves a note again that the model took back', () => {
    vi.useFakeTimers()
    const { result, actions, rerender, highlight, unmount } = setup()
    act(() => result.current.note.edit('typed'))
    act(() => {
      vi.advanceTimersByTime(NOTE_AUTOSAVE_MS)
    })
    rerender({ ...highlight })
    unmount()
    expect(actions.updateHighlight).toHaveBeenCalledTimes(2)
    expect(actions.updateHighlight).toHaveBeenLastCalledWith('h1', { note: 'typed' })
  })
})
