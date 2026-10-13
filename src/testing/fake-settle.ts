type SettleHook = () => void

export interface FakeSettle {
  afterSettle: (hook: SettleHook) => () => void
  settle: () => void
}

export const fakeSettle = (): FakeSettle => {
  const hooks = new Set<SettleHook>()
  return {
    afterSettle: (hook) => {
      hooks.add(hook)
      return () => {
        hooks.delete(hook)
      }
    },
    settle: () => {
      for (const hook of [...hooks]) hook()
    },
  }
}
