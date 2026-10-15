import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export const NOTE_AUTOSAVE_MS = 400
export const SAVED_VISIBLE_MS = 2000

export interface NoteDraft {
  value: string
  isSaved: boolean
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

const flushPending = (pending: Pending, save: SaveNote): boolean => {
  clearTimeout(pending.timer)
  if (!pending.alive || pending.latest === pending.saved) return false
  pending.saved = pending.latest
  save(pending.latest)
  return true
}

const useSavedFlag = (): [boolean, (isSaved: boolean) => void] => {
  const [isSaved, setIsSaved] = useState(false)
  useEffect(() => {
    if (!isSaved) return
    const timer = setTimeout(() => setIsSaved(false), SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [isSaved])
  return [isSaved, setIsSaved]
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

const usePending = (initial: string) =>
  useRef<Pending>({ latest: initial, saved: initial, alive: true, timer: undefined })

export const useNoteAutosave = (initial: string, save: SaveNote): NoteDraft => {
  const [value, setValue] = useState(initial)
  const [isSaved, setIsSaved] = useSavedFlag()
  const pending = usePending(initial)
  const saveRef = useRef(save)
  saveRef.current = save
  const flush = useCallback(() => {
    if (flushPending(pending.current, saveRef.current)) setIsSaved(true)
  }, [setIsSaved])
  const edit = useCallback(
    (next: string) => {
      setValue(next)
      setIsSaved(false)
      schedulePending(pending.current, next, flush)
    },
    [flush, setIsSaved],
  )
  const discard = useCallback(() => cancelPending(pending.current), [])
  const reseed = useCallback((saved: string) => {
    pending.current.saved = saved
  }, [])
  useEffect(() => flush, [flush])
  return { value, isSaved, edit, flush, discard, reseed }
}
