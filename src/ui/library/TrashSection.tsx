import { useState } from 'preact/hooks'
import { TRASH_LABEL } from '@/model'
import { daysUntilPurge } from '@/retention'
import { Icon } from '../Icon'
import type { UiActions } from '../types'
import { HighlightRow } from './HighlightRow'
import type { LibraryGroup } from './library-filter'

const removalLabel = (days: number): string => {
  if (days <= 0) return 'Removed today'
  return `Removed in ${days} ${days === 1 ? 'day' : 'days'}`
}

interface DeleteControlProps {
  confirming: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}

const DeleteControl = ({ confirming, onAsk, onCancel, onConfirm }: DeleteControlProps) => {
  if (!confirming) {
    return (
      <button type="button" class="hl-chip hl-chip--small" onClick={onAsk}>
        Delete now
      </button>
    )
  }
  return (
    <span class="hl-trashed__confirm">
      <span>Delete permanently?</span>
      <button type="button" class="hl-chip hl-chip--small hl-chip--danger" onClick={onConfirm}>
        Delete
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
  const [confirming, setConfirming] = useState(false)
  const { conversation, highlights } = group
  return (
    <div class="hl-trashed">
      <div class="hl-trashed__head">
        <Icon name="trash" size="sm" />
        <strong class="hl-trashed__title">{conversation.title}</strong>
        <span class="hl-trashed__when">{removalLabel(daysUntilPurge(conversation, now))}</span>
        <DeleteControl
          confirming={confirming}
          onAsk={() => setConfirming(true)}
          onCancel={() => setConfirming(false)}
          onConfirm={() => actions.purgeConversation(conversation.id)}
        />
      </div>
      {highlights.map((highlight) => (
        <HighlightRow
          key={highlight.id}
          highlight={highlight}
          now={now}
          orphan={false}
          inTrash
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
