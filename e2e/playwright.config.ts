import { defineConfig } from '@playwright/test'
import type { ThemeOption } from './fixtures'

const PERFORMANCE_SPEC = /performance\.spec\.ts$/
const FIREFOX_SPECS = /firefox\/.*\.spec\.ts$/
const TEST_TIMEOUT_MS = 45_000
const PARALLEL_WORKERS = 2

export default defineConfig<ThemeOption>({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  testIgnore: FIREFOX_SPECS,
  outputDir: '../test-results/artifacts',
  timeout: TEST_TIMEOUT_MS,
  workers: PARALLEL_WORKERS,
  reporter: 'list',
  projects: [
    { name: 'light', testIgnore: [PERFORMANCE_SPEC, FIREFOX_SPECS], use: { theme: 'light' } },
    { name: 'dark', testIgnore: [PERFORMANCE_SPEC, FIREFOX_SPECS], use: { theme: 'dark' } },
    {
      name: 'performance',
      testMatch: PERFORMANCE_SPEC,
      dependencies: ['light', 'dark'],
      workers: 1,
    },
  ],
})
