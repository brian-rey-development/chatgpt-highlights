import { type Highlight, tagLabel } from '@/model'
import { Icon, type IconName } from '../Icon'
import type { UiActions } from '../types'
import { timeAgo } from './time-ago'

interface RowAction {
  label: string
  icon: IconName
  offeredInTrash: boolean
  run: (actions: UiActions, highlight: Highlight) => void
}

const ROW_ACTIONS: readonly RowAction[] = [
  {
    label: 'Ask about this',
    icon: 'quote',
    offeredInTrash: false,
    run: (actions, highlight) => actions.askAbout(highlight),
  },
  {
    label: 'Copy as Markdown',
    icon: 'copy',
    offeredInTrash: true,
    run: (actions, highlight) => actions.copyMarkdown(highlight),
  },
  {
    label: 'Open in chat',
    icon: 'open',
    offeredInTrash: false,
    run: (actions, highlight) => actions.jumpTo(highlight),
  },
]

const NOT_FOUND_LABEL = 'Not found in chat'

interface RowBodyProps {
  highlight: Highlight
  now: number
  orphan: boolean
}

const RowNote = ({ note }: { note: string }) => (
  <span class="hl-row__note">
    <Icon name="note" size="sm" />
    <span>{note}</span>
  </span>
)

const RowMeta = ({ highlight, now, orphan }: RowBodyProps) => (
  <span class="hl-row__meta">
    <time dateTime={new Date(highlight.createdAt).toISOString()}>
      {timeAgo(highlight.createdAt, now)}
    </time>
    {highlight.tags.map((tag) => (
      <span key={tag} class="hl-tag">
        {tagLabel(tag)}
      </span>
    ))}
    {orphan && <span class="hl-row__orphan">{NOT_FOUND_LABEL}</span>}
  </span>
)

const RowBody = (props: RowBodyProps) => (
  <>
    <span class="hl-row__bar" data-color={props.highlight.color} />
    <span class="hl-row__body">
      <span class="hl-row__quote">{props.highlight.quote.exact}</span>
      {props.highlight.note !== '' && <RowNote note={props.highlight.note} />}
      <RowMeta {...props} />
    </span>
  </>
)

interface HighlightRowProps extends RowBodyProps {
  inTrash: boolean
  actions: UiActions
}

const RowActions = ({ highlight, inTrash, actions }: Omit<HighlightRowProps, 'now' | 'orphan'>) => (
  <div class="hl-row__actions">
    {ROW_ACTIONS.filter((action) => !inTrash || action.offeredInTrash).map((action) => (
      <button
        key={action.label}
        type="button"
        class="hl-icon-button"
        title={action.label}
        aria-label={action.label}
        onClick={() => action.run(actions, highlight)}
      >
        <Icon name={action.icon} size="sm" />
      </button>
    ))}
  </div>
)

export const HighlightRow = ({ inTrash, actions, ...body }: HighlightRowProps) => (
  <article class="hl-row">
    {inTrash ? (
      <div class="hl-row__main">
        <RowBody {...body} />
      </div>
    ) : (
      <button type="button" class="hl-row__main" onClick={() => actions.jumpTo(body.highlight)}>
        <RowBody {...body} />
      </button>
    )}
    <RowActions highlight={body.highlight} inTrash={inTrash} actions={actions} />
  </article>
)
