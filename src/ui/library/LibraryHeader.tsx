import type { ComponentChildren } from 'preact'
import { HIGHLIGHT_COLORS, type HighlightColor, SEARCH_LABEL, tagLabel } from '@/model'
import { COLOR_LABELS } from '../ColorDots'
import { Icon } from '../Icon'
import type { LibraryFilter } from '../types'

interface ChipProps {
  on: boolean
  color?: HighlightColor
  onClick: () => void
  children: ComponentChildren
}

const Chip = ({ on, color, onClick, children }: ChipProps) => (
  <button
    type="button"
    class={on ? 'hl-chip hl-chip--on' : 'hl-chip'}
    aria-pressed={on}
    data-color={color}
    onClick={onClick}
  >
    {color !== undefined && <span class="hl-dot hl-dot--small" />}
    {children}
  </button>
)

interface FilterChipsProps {
  filter: LibraryFilter
  tags: readonly string[]
  onFilter: (filter: LibraryFilter) => void
}

const FilterChips = ({ filter, tags, onFilter }: FilterChipsProps) => (
  <div class="hl-chips">
    <Chip
      on={filter.color === null && filter.tag === null}
      onClick={() => onFilter({ ...filter, color: null, tag: null })}
    >
      All
    </Chip>
    {HIGHLIGHT_COLORS.map((color) => (
      <Chip
        key={color}
        color={color}
        on={filter.color === color}
        onClick={() => onFilter({ ...filter, color: filter.color === color ? null : color })}
      >
        {COLOR_LABELS[color]}
      </Chip>
    ))}
    {tags.map((tag) => (
      <Chip
        key={tag}
        on={filter.tag === tag}
        onClick={() => onFilter({ ...filter, tag: filter.tag === tag ? null : tag })}
      >
        {tagLabel(tag)}
      </Chip>
    ))}
  </div>
)

interface LibraryHeaderProps extends FilterChipsProps {
  children: ComponentChildren
}

export const LibraryHeader = ({ children, ...chips }: LibraryHeaderProps) => (
  <header class="hl-library__header">
    <div class="hl-library__title-row">
      <h1 class="hl-library__title">Highlights</h1>
      {children}
    </div>
    <label class="hl-search">
      <Icon name="search" />
      <input
        value={chips.filter.text}
        placeholder={SEARCH_LABEL}
        aria-label={SEARCH_LABEL}
        onInput={(event) => chips.onFilter({ ...chips.filter, text: event.currentTarget.value })}
      />
    </label>
    <FilterChips {...chips} />
  </header>
)
