import { vi } from 'vitest'

class FakeDataTransfer {
  private readonly store = new Map<string, string>()

  setData(type: string, value: string): void {
    this.store.set(type, value)
  }

  getData(type: string): string {
    return this.store.get(type) ?? ''
  }
}

class FakeClipboardEvent extends Event {
  readonly clipboardData: FakeDataTransfer | null

  constructor(type: string, init: EventInit & { clipboardData?: FakeDataTransfer } = {}) {
    super(type, init)
    this.clipboardData = init.clipboardData ?? null
  }
}

export const installFakeClipboard = (): void => {
  vi.stubGlobal('DataTransfer', FakeDataTransfer)
  vi.stubGlobal('ClipboardEvent', FakeClipboardEvent)
}

export const installFakeClipboardWriter = (
  accept: (text: string) => Promise<void> = async () => undefined,
): string[] => {
  const written: string[] = []
  const writeText = async (text: string): Promise<void> => {
    await accept(text)
    written.push(text)
  }
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  return written
}

export const recordPastes = (target: Element): string[] => {
  const pasted: string[] = []
  target.addEventListener('paste', (event) => {
    if (event instanceof ClipboardEvent) {
      pasted.push(event.clipboardData?.getData('text/plain') ?? '')
    }
  })
  return pasted
}
