import { useEffect, useState } from 'preact/hooks'
import type { Highlight, HighlightColor } from '@/model'
import { type NoteDraft, useNoteAutosave } from './note-autosave'
import type { PopoverModel, UiActions } from './types'

interface PopoverDraft {
  color: HighlightColor
  tags: readonly string[]
  note: NoteDraft
  pickColor: (next: HighlightColor) => void
  changeTags: (next: string[]) => void
  ask: () => void
  remove: () => void
  close: () => void
}

const useModelDraft = <T>(highlight: Highlight, seed: T): [T, (next: T) => void] => {
  const [draft, setDraft] = useState(seed)
  useEffect(() => setDraft(seed), [highlight, seed])
  return [draft, setDraft]
}

const useModelNote = (highlight: Highlight, actions: UiActions): NoteDraft => {
  const note = useNoteAutosave(highlight.note, (text) =>
    actions.updateHighlight(highlight.id, { note: text }),
  )
  const { reseed } = note
  useEffect(() => reseed(highlight.note), [highlight, reseed])
  return note
}

export const usePopoverDraft = ({ highlight }: PopoverModel, actions: UiActions): PopoverDraft => {
  const [color, setColor] = useModelDraft(highlight, highlight.color)
  const [tags, setTags] = useModelDraft(highlight, highlight.tags)
  const note = useModelNote(highlight, actions)
  const pickColor = (next: HighlightColor) => {
    if (next === color) return
    setColor(next)
    actions.updateHighlight(highlight.id, { color: next })
  }
  const changeTags = (next: string[]) => {
    setTags(next)
    actions.updateHighlight(highlight.id, { tags: next })
  }
  const ask = () => {
    note.flush()
    actions.askAbout({ ...highlight, color, tags: [...tags], note: note.value })
  }
  const remove = () => {
    note.discard()
    actions.removeHighlight(highlight.id)
  }
  const close = () => {
    note.flush()
    actions.closePopover()
  }
  return { color, tags, note, pickColor, changeTags, ask, remove, close }
}
