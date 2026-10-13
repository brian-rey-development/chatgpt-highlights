import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export const NOTE_AUTOSAVE_MS = 400

export interface NoteDraft {
  value: string
  edit: (next: string) => void
  flush: () => void
  discard: () => void
  reseed: (saved: string) => void
}

interface Pending {
  latest: string
  saved: string
  alive: boolean
  timer: ReturnType<typeof setTimeout> | undefined
}

type SaveNote = (note: string) => void

const flushPending = (pending: Pending, save: SaveNote) => {
  clearTimeout(pending.timer)
  if (!pending.alive || pending.latest === pending.saved) return
  pending.saved = pending.latest
  save(pending.latest)
}

const schedulePending = (pending: Pending, next: string, flush: () => void) => {
  pending.latest = next
  clearTimeout(pending.timer)
  pending.timer = setTimeout(flush, NOTE_AUTOSAVE_MS)
}

const cancelPending = (pending: Pending) => {
  pending.alive = false
  clearTimeout(pending.timer)
}

export const useNoteAutosave = (initial: string, save: SaveNote): NoteDraft => {
  const [value, setValue] = useState(initial)
  const pending = useRef<Pending>({
    latest: initial,
    saved: initial,
    alive: true,
    timer: undefined,
  })
  const saveRef = useRef(save)
  saveRef.current = save
  const flush = useCallback(() => flushPending(pending.current, saveRef.current), [])
  const edit = useCallback(
    (next: string) => {
      setValue(next)
      schedulePending(pending.current, next, flush)
    },
    [flush],
  )
  const discard = useCallback(() => cancelPending(pending.current), [])
  const reseed = useCallback((saved: string) => {
    pending.current.saved = saved
  }, [])
  useEffect(() => flush, [flush])
  return { value, edit, flush, discard, reseed }
}
