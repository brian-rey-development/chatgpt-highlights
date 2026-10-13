import type { ReadonlySignal } from '@preact/signals'
import type { Highlight, HighlightColor, HighlightPatch, Snapshot } from '@/model'

export interface PillModel {
  anchor: DOMRect
  dock: DOMRect | null
}

export interface PopoverModel {
  highlight: Highlight
  anchor: DOMRect
}

export interface ToastModel {
  id: number
  message: string
  action: { label: string; run: () => void } | null
}

export interface LibraryModel {
  snapshot: Snapshot
  now: number
}

export interface LibraryFilter {
  text: string
  color: HighlightColor | null
  tag: string | null
}

export interface UiState {
  pill: ReadonlySignal<PillModel | null>
  popover: ReadonlySignal<PopoverModel | null>
  toast: ReadonlySignal<ToastModel | null>
  library: ReadonlySignal<LibraryModel | null>
  libraryFrame: ReadonlySignal<DOMRect | null>
  orphanIds: ReadonlySignal<ReadonlySet<string>>
}

export interface UiActions {
  highlightSelection: (color: HighlightColor, withNote: boolean) => void
  updateHighlight: (id: string, patch: HighlightPatch) => void
  removeHighlight: (id: string) => void
  askAbout: (highlight: Highlight) => void
  closePopover: () => void
  dismissToast: () => void
  closeLibrary: () => void
  jumpTo: (highlight: Highlight) => void
  copyMarkdown: (highlight: Highlight) => void
  exportMarkdown: (highlights: readonly Highlight[]) => void
  exportBackup: () => void
  importBackup: (file: File) => void
  purgeConversation: (conversationId: string) => void
}
