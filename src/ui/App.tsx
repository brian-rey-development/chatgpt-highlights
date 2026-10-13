import { HighlightPopover } from './HighlightPopover'
import { LibraryView } from './library/LibraryView'
import { SelectionPill } from './SelectionPill'
import { Toast } from './Toast'
import type { UiActions, UiState } from './types'

interface AppProps {
  state: UiState
  actions: UiActions
}

const PillLayer = ({ state, actions }: AppProps) => {
  const pill = state.pill.value
  return pill && <SelectionPill model={pill} actions={actions} />
}

const PopoverLayer = ({ state, actions }: AppProps) => {
  const popover = state.popover.value
  return popover && <HighlightPopover model={popover} actions={actions} />
}

const ToastLayer = ({ state, actions }: AppProps) => {
  const toast = state.toast.value
  return toast && <Toast key={toast.id} model={toast} actions={actions} />
}

const LibraryLayer = ({ state, actions }: AppProps) => {
  const library = state.library.value
  const frame = state.libraryFrame.value
  if (!library || !frame) return null
  return (
    <LibraryView
      model={library}
      frame={frame}
      orphanIds={state.orphanIds.value}
      actions={actions}
    />
  )
}

export const App = (props: AppProps) => (
  <>
    <PillLayer {...props} />
    <PopoverLayer {...props} />
    <ToastLayer {...props} />
    <LibraryLayer {...props} />
  </>
)
