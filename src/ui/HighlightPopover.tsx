import type { RefObject } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { type HighlightColor, LIMITS } from '@/model'
import { ColorDots, colorLabel } from './ColorDots'
import { Icon } from './Icon'
import { placePopover, usePlacement } from './placement'
import { usePopoverDraft } from './popover-draft'
import { TagField } from './TagField'
import type { PopoverModel, UiActions } from './types'

const CLOSE_LABEL = 'Close'
const COUNTER_START_RATIO = 0.9

export const NOTE_COUNTER_FROM_CHARS = Math.floor(LIMITS.noteChars * COUNTER_START_RATIO)

interface PopoverProps {
  model: PopoverModel
  actions: UiActions
}

interface NoteFieldProps {
  value: string
  onInput: (value: string) => void
}

const useFocusOnMount = (ref: RefObject<HTMLElement>, active: boolean) => {
  useEffect(() => {
    if (active) ref.current?.focus({ preventScroll: true })
  }, [])
}

const NoteField = ({ value, onInput }: NoteFieldProps) => {
  const field = useRef<HTMLTextAreaElement>(null)
  useFocusOnMount(field, value === '')
  return (
    <textarea
      ref={field}
      class="hl-popover__note"
      value={value}
      maxLength={LIMITS.noteChars}
      placeholder="Add a note"
      aria-label="Note"
      onInput={(event) => onInput(event.currentTarget.value)}
    />
  )
}

interface NoteMetaProps {
  length: number
  isSaved: boolean
}

const NoteMeta = ({ length, isSaved }: NoteMetaProps) => (
  <div class="hl-popover__meta">
    <span role="status" aria-label="Note status">
      {isSaved && 'Saved'}
    </span>
    {length >= NOTE_COUNTER_FROM_CHARS && (
      <span>
        {length} / {LIMITS.noteChars}
      </span>
    )}
  </div>
)

interface FooterProps {
  onAsk: () => void
  onRemove: () => void
}

const PopoverFooter = ({ onAsk, onRemove }: FooterProps) => (
  <div class="hl-popover__actions">
    <button type="button" class="hl-menu-item" onClick={onAsk}>
      <Icon name="quote" size="md" />
      Ask about this
    </button>
    <button type="button" class="hl-menu-item hl-menu-item--danger" onClick={onRemove}>
      <Icon name="trash" size="md" />
      Remove
    </button>
  </div>
)

const closeOnEscape = (close: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

interface HeaderProps {
  color: HighlightColor
  onPick: (color: HighlightColor) => void
  onClose: () => void
}

const PopoverHeader = ({ color, onPick, onClose }: HeaderProps) => (
  <div class="hl-popover__header">
    <ColorDots current={color} size="md" labelFor={colorLabel} onPick={onPick} />
    <button
      type="button"
      class="hl-icon-button"
      title={CLOSE_LABEL}
      aria-label={CLOSE_LABEL}
      onClick={onClose}
    >
      <Icon name="close" size="md" />
    </button>
  </div>
)

const PopoverBody = ({ model, actions }: PopoverProps) => {
  const draft = usePopoverDraft(model, actions)
  const { ref, style } = usePlacement<HTMLDivElement, PopoverModel>(model, placePopover)
  useFocusOnMount(ref, model.highlight.note !== '')
  return (
    <div
      ref={ref}
      class="hl-popover"
      role="dialog"
      aria-label="Highlight"
      tabIndex={-1}
      style={style}
      onKeyDown={closeOnEscape(draft.close)}
    >
      <PopoverHeader color={draft.color} onPick={draft.pickColor} onClose={draft.close} />
      <NoteField value={draft.note.value} onInput={draft.note.edit} />
      <NoteMeta length={draft.note.value.length} isSaved={draft.note.isSaved} />
      <TagField tags={draft.tags} onChange={draft.changeTags} />
      <PopoverFooter onAsk={draft.ask} onRemove={draft.remove} />
    </div>
  )
}

export const HighlightPopover = (props: PopoverProps) => (
  <PopoverBody key={props.model.highlight.id} {...props} />
)
