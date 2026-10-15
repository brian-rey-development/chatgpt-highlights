import { type Signal, signal } from '@preact/signals'
import { type AppError, userMessageOf } from '@/errors'
import type { Conversation, Highlight } from '@/model'
import type { Painter } from '@/painter'
import type { LibraryModel, PillModel, PopoverModel, ToastModel, UiState } from '@/ui'

export interface Store extends UiState {
  conversationId: Signal<string | null>
  conversation: Signal<Conversation | null>
  highlights: Signal<ReadonlyMap<string, Highlight>>
  pill: Signal<PillModel | null>
  popover: Signal<PopoverModel | null>
  toast: Signal<ToastModel | null>
  library: Signal<LibraryModel | null>
  libraryFrame: Signal<DOMRect | null>
  libraryOver: Signal<string | null>
  orphanIds: Signal<ReadonlySet<string>>
}

export interface Runtime {
  doc: Document
  store: Store
  painter: Painter
  shadowRoot: ShadowRoot
}

export const TOAST_MS = 6_000
export const UNDO_TOAST_MS = 10_000
export const LOAD_FAILED_MESSAGE = "Couldn't load highlights"

let lastToastId = 0

export const createStore = (): Store => ({
  conversationId: signal(null),
  conversation: signal(null),
  highlights: signal(new Map()),
  pill: signal(null),
  popover: signal(null),
  toast: signal(null),
  library: signal(null),
  libraryFrame: signal(null),
  libraryOver: signal(null),
  orphanIds: signal(new Set()),
})

export const showToast = (store: Store, toast: Omit<ToastModel, 'id'>): void => {
  lastToastId += 1
  const id = lastToastId
  store.toast.value = { ...toast, id }
  setTimeout(
    () => {
      if (store.toast.value?.id === id) store.toast.value = null
    },
    toast.action ? UNDO_TOAST_MS : TOAST_MS,
  )
}

export const showMessage = (store: Store, message: string): void =>
  showToast(store, { message, action: null })

export const showFailure = (store: Store, error: AppError): void =>
  showMessage(store, userMessageOf(error))
