import { useState } from 'preact/hooks'
import { addTag, normalizeTag, tagLabel } from '@/model'

interface TagFieldProps {
  tags: readonly string[]
  onChange: (tags: string[]) => void
}

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
  return { draft, setDraft, onKeyDown }
}

export const TagField = (props: TagFieldProps) => {
  const { draft, setDraft, onKeyDown } = useTagDraft(props)
  return (
    <div class="hl-tags">
      {props.tags.map((tag) => (
        <span key={tag} class="hl-tag">
          {tagLabel(tag)}
        </span>
      ))}
      <input
        class="hl-tags__input"
        value={draft}
        placeholder="Add tag"
        aria-label="Add tag"
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
