import { vi } from 'vitest'

export interface FakeResizeObservers {
  observed: () => Element[]
  resize: () => void
}

export const installFakeResizeObserver = (): FakeResizeObservers => {
  const live = new Set<FakeResizeObserver>()

  class FakeResizeObserver {
    readonly targets = new Set<Element>()

    constructor(readonly callback: () => void) {
      live.add(this)
    }

    observe(target: Element): void {
      this.targets.add(target)
    }

    unobserve(target: Element): void {
      this.targets.delete(target)
    }

    disconnect(): void {
      this.targets.clear()
      live.delete(this)
    }
  }

  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  return {
    observed: () => [...live].flatMap((observer) => [...observer.targets]),
    resize: () => {
      for (const observer of live) observer.callback()
    },
  }
}
