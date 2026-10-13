import { useMemo, useState } from 'preact/hooks'
import { LIBRARY_LABEL, type Snapshot } from '@/model'
import type { LibraryFilter, LibraryModel, UiActions } from '../types'
import { ExportMenu } from './ExportMenu'
import { HighlightRow } from './HighlightRow'
import { LibraryHeader } from './LibraryHeader'
import { countRows, groupLibrary, type LibraryGroup, tagsInUse, takeRows } from './library-filter'
import { TrashSection } from './TrashSection'

export const PAGE_SIZE = 200
const NO_FILTER: LibraryFilter = { text: '', color: null, tag: null }

const useLibraryQuery = (snapshot: Snapshot) => {
  const [filter, setFilter] = useState(NO_FILTER)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const sections = useMemo(() => groupLibrary(snapshot, filter), [snapshot, filter])
  const tags = useMemo(() => tagsInUse(snapshot), [snapshot])
  const changeFilter = (next: LibraryFilter) => {
    setFilter(next)
    setLimit(PAGE_SIZE)
  }
  const showMore = () => setLimit(limit + PAGE_SIZE)
  return { filter, changeFilter, sections, tags, limit, showMore }
}

type Query = ReturnType<typeof useLibraryQuery>

interface ActiveGroupsProps {
  groups: readonly LibraryGroup[]
  now: number
  orphanIds: ReadonlySet<string>
  actions: UiActions
}

const ActiveGroups = ({ groups, now, orphanIds, actions }: ActiveGroupsProps) => (
  <>
    {groups.map(({ conversation, highlights }) => (
      <section key={conversation.id} class="hl-group" aria-label={conversation.title}>
        <header class="hl-group__head">
          <h2 class="hl-group__title">{conversation.title}</h2>
          <span class="hl-group__count">{highlights.length}</span>
        </header>
        {highlights.map((highlight) => (
          <HighlightRow
            key={highlight.id}
            highlight={highlight}
            now={now}
            orphan={orphanIds.has(highlight.id)}
            inTrash={false}
            actions={actions}
          />
        ))}
      </section>
    ))}
  </>
)

const EMPTY_COPY = {
  none: 'No highlights yet. Select text in a ChatGPT answer to save your first one.',
  filtered: 'No highlights match this filter.',
}

const frameStyle = (frame: DOMRect) => ({
  left: frame.left,
  top: frame.top,
  width: frame.width,
  height: frame.height,
})

interface LibraryViewProps {
  model: LibraryModel
  frame: DOMRect
  orphanIds: ReadonlySet<string>
  actions: UiActions
}

interface ResultsProps extends Omit<LibraryViewProps, 'frame'> {
  query: Query
}

const LibraryResults = ({ query, model, orphanIds, actions }: ResultsProps) => {
  const { active, trashed } = query.sections
  const isEmpty = active.length === 0 && trashed.length === 0
  const emptyCopy = model.snapshot.highlights.length === 0 ? EMPTY_COPY.none : EMPTY_COPY.filtered
  return (
    <>
      {isEmpty && <p class="hl-library__empty">{emptyCopy}</p>}
      <ActiveGroups
        groups={takeRows(active, query.limit)}
        now={model.now}
        orphanIds={orphanIds}
        actions={actions}
      />
      {countRows(active) > query.limit && (
        <button type="button" class="hl-chip hl-chip--outline" onClick={query.showMore}>
          Show more
        </button>
      )}
      <TrashSection groups={trashed} now={model.now} actions={actions} />
    </>
  )
}

export const LibraryView = ({ frame, ...rest }: LibraryViewProps) => {
  const query = useLibraryQuery(rest.model.snapshot)
  return (
    <section class="hl-library" aria-label={LIBRARY_LABEL} style={frameStyle(frame)}>
      <div class="hl-library__page">
        <LibraryHeader filter={query.filter} tags={query.tags} onFilter={query.changeFilter}>
          <ExportMenu groups={query.sections.active} actions={rest.actions} />
        </LibraryHeader>
        <LibraryResults query={query} {...rest} />
      </div>
    </section>
  )
}
