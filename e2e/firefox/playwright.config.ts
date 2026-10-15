import { defineConfig } from '@playwright/test'

const TEST_TIMEOUT_MS = 90_000

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  outputDir: '../../test-results/firefox',
  timeout: TEST_TIMEOUT_MS,
  workers: 1,
  reporter: 'list',
})
