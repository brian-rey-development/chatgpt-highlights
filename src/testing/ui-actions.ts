import { vi } from 'vitest'
import type { UiActions } from '@/ui'

export const fakeActions = (overrides: Partial<UiActions> = {}): UiActions => ({
  highlightSelection: vi.fn(),
  updateHighlight: vi.fn(),
  removeHighlight: vi.fn(),
  askAbout: vi.fn(),
  closePopover: vi.fn(),
  dismissToast: vi.fn(),
  closeLibrary: vi.fn(),
  jumpTo: vi.fn(),
  copyMarkdown: vi.fn(),
  exportMarkdown: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  purgeConversation: vi.fn(),
  ...overrides,
})
