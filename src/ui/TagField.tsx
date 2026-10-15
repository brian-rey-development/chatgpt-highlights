import { useState } from 'preact/hooks'
import { addTag, LIMITS, normalizeTag, tagLabel } from '@/model'
import { Icon } from './Icon'

interface TagFieldProps {
  tags: readonly string[]
  onChange: (tags: string[]) => void
}

export const TAG_COUNTER_FROM_CHARS = 30

type KeyIntent = 'commit' | 'pop' | null

const intentOf = (event: KeyboardEvent, canPop: boolean): KeyIntent => {
  if (event.isComposing) return null
  if (event.key === 'Enter') return 'commit'
  return event.key === 'Backspace' && canPop ? 'pop' : null
}

const accepted = (tags: readonly string[], draft: string): string[] | null => {
  const tag = normalizeTag(draft)
  if (tag === null) return null
  const next = addTag(tags, draft)
  return next.includes(tag) ? next : null
}

interface Hint {
  text: string
  isOver: boolean
}

const hintFor = (tags: readonly string[], draft: string): Hint | null => {
  if (tags.length >= LIMITS.tags)
    return { text: `Up to ${LIMITS.tags} tags per highlight`, isOver: true }
  const length = draft.trim().length
  if (length < TAG_COUNTER_FROM_CHARS) return null
  return { text: `${length} / ${LIMITS.tagChars}`, isOver: length > LIMITS.tagChars }
}

const useTagDraft = ({ tags, onChange }: TagFieldProps) => {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const next = accepted(tags, draft)
    if (next === null) return
    setDraft('')
    if (next.length > tags.length) onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const intent = intentOf(event, draft === '' && tags.length > 0)
    if (intent === 'pop') onChange(tags.slice(0, -1))
    if (intent !== 'commit') return
    event.preventDefault()
    commit()
  }
  return { draft, setDraft, onKeyDown, commit }
}

interface TagChipProps {
  tag: string
  onRemove: () => void
}

const TagChip = ({ tag, onRemove }: TagChipProps) => (
  <span class="hl-tag hl-tag--removable">
    {tagLabel(tag)}
    <button
      type="button"
      class="hl-tag__remove"
      aria-label={`Remove tag ${tagLabel(tag)}`}
      onClick={onRemove}
    >
      <Icon name="close" size="sm" />
    </button>
  </span>
)

const TagHint = ({ hint }: { hint: Hint }) => (
  <span role="status" class={hint.isOver ? 'hl-tags__hint hl-tags__hint--over' : 'hl-tags__hint'}>
    {hint.text}
  </span>
)

export const TagField = (props: TagFieldProps) => {
  const { draft, setDraft, onKeyDown, commit } = useTagDraft(props)
  const hint = hintFor(props.tags, draft)
  return (
    <div class="hl-tags">
      {props.tags.map((tag) => (
        <TagChip
          key={tag}
          tag={tag}
          onRemove={() => props.onChange(props.tags.filter((other) => other !== tag))}
        />
      ))}
      <input
        class="hl-tags__input"
        value={draft}
        placeholder="Add tag"
        aria-label="Add tag"
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      {hint && <TagHint hint={hint} />}
    </div>
  )
}
