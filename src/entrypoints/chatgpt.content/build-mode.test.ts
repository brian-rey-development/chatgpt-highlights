import { describe, expect, it, vi } from 'vitest'

const loadBuildMode = async (): Promise<boolean> => {
  vi.resetModules()
  return (await import('./build-mode')).IS_E2E_BUILD
}

describe('IS_E2E_BUILD', () => {
  it('is false in a production-shaped build', async () => {
    expect(await loadBuildMode()).toBe(false)
  })

  it('is true in the e2e build', async () => {
    vi.stubEnv('MODE', 'e2e')
    expect(await loadBuildMode()).toBe(true)
  })
})
