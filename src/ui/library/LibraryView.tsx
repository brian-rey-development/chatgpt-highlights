import { useMemo, useRef, useState } from 'preact/hooks'
import { LIBRARY_LABEL, type Snapshot } from '@/model'
import type { LibraryFilter, LibraryGroup, LibraryModel, UiActions } from '../types'
import { ExportMenu } from './ExportMenu'
import { useFocusScope } from './focus-scope'
import { HighlightRow } from './HighlightRow'
import { ImportButton } from './ImportButton'
import { LibraryHeader } from './LibraryHeader'
import { countRows, groupLibrary, tagsInUse, takeRows } from './library-filter'
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
            isOrphan={orphanIds.has(highlight.id)}
            isInTrash={false}
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

interface LibraryContentProps {
  model: LibraryModel
  orphanIds: ReadonlySet<string>
  actions: UiActions
}

interface ResultsProps extends LibraryContentProps {
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

const LibraryContent = (props: LibraryContentProps) => {
  const query = useLibraryQuery(props.model.snapshot)
  return (
    <>
      <LibraryHeader
        filter={query.filter}
        tags={query.tags}
        onFilter={query.changeFilter}
        onClose={props.actions.closeLibrary}
      >
        <ImportButton onFile={props.actions.importBackup} />
        <ExportMenu groups={query.sections.active} actions={props.actions} />
      </LibraryHeader>
      <LibraryResults query={query} {...props} />
    </>
  )
}

interface LibraryViewProps {
  model: LibraryModel | null
  frame: DOMRect
  orphanIds: ReadonlySet<string>
  actions: UiActions
}

export const LibraryView = ({ frame, model, ...rest }: LibraryViewProps) => {
  const scope = useRef<HTMLElement>(null)
  const onKeyDown = useFocusScope(scope)
  return (
    <section
      ref={scope}
      class="hl-library"
      aria-label={LIBRARY_LABEL}
      aria-busy={model === null}
      tabIndex={-1}
      style={frameStyle(frame)}
      onKeyDown={onKeyDown}
    >
      <div class="hl-library__page">
        {model ? (
          <LibraryContent model={model} {...rest} />
        ) : (
          <p class="hl-library__empty" role="status">
            Loading highlights
          </p>
        )}
      </div>
    </section>
  )
}
