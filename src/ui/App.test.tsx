import { signal } from '@preact/signals'
import { act, render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { LIBRARY_LABEL } from '@/model'
import { EMPTY_SNAPSHOT, FIXED_TIME, fakeActions, makeConversation, makeHighlight } from '@/testing'
import { App } from './App'
import type { LibraryModel, PillModel, PopoverModel, ToastModel, UiState } from './types'

const FRAME = new DOMRect(260, 52, 900, 700)

const makeState = () => {
  const pill = signal<PillModel | null>(null)
  const popover = signal<PopoverModel | null>(null)
  const toast = signal<ToastModel | null>(null)
  const library = signal<LibraryModel | null>(null)
  const libraryFrame = signal<DOMRect | null>(null)
  const orphanIds = signal<ReadonlySet<string>>(new Set())
  const state: UiState = { pill, popover, toast, library, libraryFrame, orphanIds }
  return { state, pill, popover, toast, library, libraryFrame, orphanIds }
}

const PILL: PillModel = { anchor: new DOMRect(100, 100, 80, 20), dock: null }
const POPOVER: PopoverModel = { highlight: makeHighlight(), anchor: new DOMRect(100, 100, 80, 20) }
const LIBRARY: LibraryModel = { snapshot: EMPTY_SNAPSHOT, now: FIXED_TIME }

const toastOf = (id: number, message = 'Highlight removed'): ToastModel => ({
  id,
  message,
  action: null,
})

describe('App', () => {
  it('renders nothing while every signal is empty', () => {
    const { state } = makeState()
    const { container } = render(<App state={state} actions={fakeActions()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the pill only when its signal is set', () => {
    const { state, pill } = makeState()
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    act(() => {
      pill.value = PILL
    })
    expect(screen.getByRole('toolbar', { name: 'Highlight selection' })).toBeInTheDocument()
    act(() => {
      pill.value = null
    })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('renders the popover only when its signal is set', () => {
    const { state, popover } = makeState()
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      popover.value = POPOVER
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the toast only when its signal is set', () => {
    const { state, toast } = makeState()
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => {
      toast.value = toastOf(1)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Highlight removed')
  })

  it('renders the library only when it has a frame', () => {
    const { state, library, libraryFrame } = makeState()
    render(<App state={state} actions={fakeActions()} />)
    act(() => {
      library.value = LIBRARY
    })
    expect(screen.queryByRole('region', { name: LIBRARY_LABEL })).not.toBeInTheDocument()
    act(() => {
      libraryFrame.value = FRAME
    })
    expect(screen.getByRole('region', { name: LIBRARY_LABEL })).toBeInTheDocument()
  })

  it('shows the library as loading while it has a frame but no snapshot yet', () => {
    const { state, libraryFrame } = makeState()
    libraryFrame.value = FRAME
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.getByRole('region', { name: LIBRARY_LABEL })).toHaveAttribute('aria-busy', 'true')
  })

  it('marks the library rows whose quote was not found', () => {
    const highlight = makeHighlight()
    const { state, library, libraryFrame, orphanIds } = makeState()
    library.value = {
      snapshot: { conversations: [makeConversation()], highlights: [highlight] },
      now: FIXED_TIME,
    }
    libraryFrame.value = FRAME
    orphanIds.value = new Set([highlight.id])
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.getByText('Not found in chat')).toBeInTheDocument()
  })

  it('shows several surfaces at once', () => {
    const { state, pill, toast } = makeState()
    pill.value = PILL
    toast.value = toastOf(1)
    render(<App state={state} actions={fakeActions()} />)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('keeps the same toast element while its id stays the same', () => {
    const { state, toast } = makeState()
    toast.value = toastOf(1, 'First')
    render(<App state={state} actions={fakeActions()} />)
    const first = screen.getByRole('status')
    act(() => {
      toast.value = toastOf(1, 'Edited')
    })
    expect(screen.getByRole('status')).toBe(first)
  })

  it('mounts a new toast element for each toast id so its entry replays', () => {
    const { state, toast } = makeState()
    toast.value = toastOf(1)
    render(<App state={state} actions={fakeActions()} />)
    const first = screen.getByRole('status')
    act(() => {
      toast.value = toastOf(2)
    })
    expect(screen.getByRole('status')).not.toBe(first)
  })
})
