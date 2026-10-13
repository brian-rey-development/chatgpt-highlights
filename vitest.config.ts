import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

const THRESHOLDS = { lines: 95, statements: 95, functions: 95, branches: 90 }

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { include: [/\/src\/ui\/.+\.css(?:\?|$)/] },
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', 'src/testing/**', '**/index.{ts,tsx}', '**/types.ts'],
      thresholds: THRESHOLDS,
    },
  },
})
