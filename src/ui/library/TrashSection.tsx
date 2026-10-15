import { useState } from 'preact/hooks'
import { type Conversation, TRASH_LABEL } from '@/model'
import { daysUntilPurge, PURGE_AFTER_MS } from '@/retention'
import { Icon } from '../Icon'
import type { LibraryGroup, UiActions } from '../types'
import { HighlightRow } from './HighlightRow'
import { absoluteDate } from './time-ago'

const removalLabel = (days: number): string => {
  if (days <= 0) return 'Deleted permanently today'
  return `Deleted permanently in ${days} ${days === 1 ? 'day' : 'days'}`
}

const removalDate = ({ trashedAt }: Conversation): string | undefined =>
  trashedAt === null
    ? undefined
    : `Deleted permanently on ${absoluteDate(trashedAt + PURGE_AFTER_MS)}`

interface DeleteControlProps {
  isConfirming: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}

const DeleteControl = ({ isConfirming, onAsk, onCancel, onConfirm }: DeleteControlProps) => {
  if (!isConfirming) {
    return (
      <button type="button" class="hl-chip hl-chip--small" onClick={onAsk}>
        Delete chat now
      </button>
    )
  }
  return (
    <span class="hl-trashed__confirm">
      <span>Delete this chat and all of its highlights permanently?</span>
      <button type="button" class="hl-chip hl-chip--small hl-chip--danger" onClick={onConfirm}>
        Delete permanently
      </button>
      <button type="button" class="hl-chip hl-chip--small" onClick={onCancel}>
        Cancel
      </button>
    </span>
  )
}

interface TrashedChatProps {
  group: LibraryGroup
  now: number
  actions: UiActions
}

const TrashedChat = ({ group, now, actions }: TrashedChatProps) => {
  const [isConfirming, setIsConfirming] = useState(false)
  const { conversation, highlights } = group
  return (
    <div class="hl-trashed">
      <div class="hl-trashed__head">
        <Icon name="trash" size="sm" />
        <strong class="hl-trashed__title">{conversation.title}</strong>
        <span class="hl-trashed__when" title={removalDate(conversation)}>
          {removalLabel(daysUntilPurge(conversation, now))}
        </span>
        <DeleteControl
          isConfirming={isConfirming}
          onAsk={() => setIsConfirming(true)}
          onCancel={() => setIsConfirming(false)}
          onConfirm={() => actions.purgeConversation(conversation.id)}
        />
      </div>
      {highlights.map((highlight) => (
        <HighlightRow
          key={highlight.id}
          highlight={highlight}
          now={now}
          isOrphan={false}
          isInTrash
          actions={actions}
        />
      ))}
    </div>
  )
}

interface TrashSectionProps {
  groups: readonly LibraryGroup[]
  now: number
  actions: UiActions
}

export const TrashSection = ({ groups, ...rest }: TrashSectionProps) => {
  if (groups.length === 0) return null
  return (
    <section class="hl-group" aria-label={TRASH_LABEL}>
      <header class="hl-group__head">
        <h2 class="hl-group__title">{TRASH_LABEL}</h2>
      </header>
      {groups.map((group) => (
        <TrashedChat key={group.conversation.id} group={group} {...rest} />
      ))}
    </section>
  )
}
