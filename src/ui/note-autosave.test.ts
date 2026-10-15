import { act, renderHook } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_AUTOSAVE_MS, SAVED_VISIBLE_MS, useNoteAutosave } from './note-autosave'

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const setup = (initial = 'first') => {
  const save = vi.fn()
  const hook = renderHook(() => useNoteAutosave(initial, save))
  return { save, ...hook }
}

describe('useNoteAutosave', () => {
  beforeEach(() => vi.useFakeTimers())

  it('starts with the stored note', () => {
    expect(setup().result.current.value).toBe('first')
  })

  it('saves 400 ms after the last keystroke', () => {
    const { result, save } = setup()
    act(() => result.current.edit('a'))
    advance(NOTE_AUTOSAVE_MS - 1)
    act(() => result.current.edit('ab'))
    advance(NOTE_AUTOSAVE_MS - 1)
    expect(save).not.toHaveBeenCalled()
    advance(1)
    expect(save).toHaveBeenCalledExactlyOnceWith('ab')
  })

  it('does not save when the text ends up unchanged', () => {
    const { result, save } = setup()
    act(() => result.current.edit('changed'))
    act(() => result.current.edit('first'))
    advance(NOTE_AUTOSAVE_MS)
    expect(save).not.toHaveBeenCalled()
  })

  it('flushes the pending note when the popover closes', () => {
    const { result, save, unmount } = setup()
    act(() => result.current.edit('typed just now'))
    unmount()
    expect(save).toHaveBeenCalledExactlyOnceWith('typed just now')
    advance(NOTE_AUTOSAVE_MS)
    expect(save).toHaveBeenCalledOnce()
  })

  it('does not save a note twice when flushed after the timer fired', () => {
    const { result, save, unmount } = setup()
    act(() => result.current.edit('done'))
    advance(NOTE_AUTOSAVE_MS)
    unmount()
    expect(save).toHaveBeenCalledOnce()
  })

  it('saves on demand', () => {
    const { result, save } = setup()
    act(() => result.current.edit('now'))
    act(() => result.current.flush())
    expect(save).toHaveBeenCalledExactlyOnceWith('now')
  })

  it('drops the pending note after a discard', () => {
    const { result, save, unmount } = setup()
    act(() => result.current.edit('never saved'))
    act(() => result.current.discard())
    advance(NOTE_AUTOSAVE_MS)
    unmount()
    expect(save).not.toHaveBeenCalled()
  })

  it('saves again what the model took back once it is told what it holds', () => {
    const { result, save, unmount } = setup()
    act(() => result.current.edit('rejected'))
    advance(NOTE_AUTOSAVE_MS)
    act(() => result.current.reseed('first'))
    unmount()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('rejected')
  })

  it('is not saved before anything is written', () => {
    expect(setup().result.current.isSaved).toBe(false)
  })

  it('reports saved once the note is written, then goes quiet again', () => {
    const { result } = setup()
    act(() => result.current.edit('typed'))
    advance(NOTE_AUTOSAVE_MS)
    expect(result.current.isSaved).toBe(true)
    advance(SAVED_VISIBLE_MS)
    expect(result.current.isSaved).toBe(false)
  })

  it('hides the confirmation as soon as the next keystroke arrives', () => {
    const { result } = setup()
    act(() => result.current.edit('typed'))
    advance(NOTE_AUTOSAVE_MS)
    act(() => result.current.edit('typed more'))
    expect(result.current.isSaved).toBe(false)
  })

  it('reports saved after a save on demand', () => {
    const { result } = setup()
    act(() => result.current.edit('now'))
    act(() => result.current.flush())
    expect(result.current.isSaved).toBe(true)
  })

  it('stays unsaved when a flush finds nothing new to write', () => {
    const { result } = setup()
    act(() => result.current.flush())
    expect(result.current.isSaved).toBe(false)
  })
})
