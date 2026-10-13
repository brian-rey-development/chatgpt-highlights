import { DEFAULT_COLOR, type HighlightColor } from '@/model'
import { ColorDots } from './ColorDots'
import { Icon } from './Icon'
import { placePill, usePlacement } from './placement'

import type { PillModel, UiActions } from './types'

interface SelectionPillProps {
  model: PillModel
  actions: UiActions
}

const NOTE_LABEL = 'Highlight and add note'
const colorLabelFor = (color: HighlightColor): string => `Highlight ${color}`
const keepSelection = (event: MouseEvent) => event.preventDefault()

const NoteButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    class="hl-icon-button"
    title={NOTE_LABEL}
    aria-label={NOTE_LABEL}
    onClick={onClick}
  >
    <Icon name="note" size="sm" />
  </button>
)

export const SelectionPill = ({ model, actions }: SelectionPillProps) => {
  const { ref, style } = usePlacement<HTMLDivElement, PillModel>(model, placePill)
  const withNote = () => actions.highlightSelection(DEFAULT_COLOR, true)
  return (
    <div
      ref={ref}
      class="hl-pill"
      role="toolbar"
      aria-label="Highlight selection"
      style={{ ...style, height: model.dock?.height }}
      onMouseDown={keepSelection}
    >
      <ColorDots
        current={null}
        size="sm"
        labelFor={colorLabelFor}
        onPick={(color) => actions.highlightSelection(color, false)}
      />
      <NoteButton onClick={withNote} />
    </div>
  )
}
