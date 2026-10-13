import preact from '@preact/preset-vite'
import { defineConfig } from 'wxt'

const FIREFOX_SETTINGS = {
  browser_specific_settings: {
    gecko: {
      id: 'chatgpt-highlights@brian-rey-development',
      strict_min_version: '140.0',
      data_collection_permissions: { required: ['none'] },
    },
    gecko_android: { strict_min_version: '142.0' },
  },
}

const CHROME_SETTINGS = { minimum_chrome_version: '128' }

const REVIEWABLE_SOURCES = [
  'src/**',
  'public/**',
  'assets/**',
  'scripts/**',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'wxt.config.ts',
  'README.md',
  'LICENSE',
]

export default defineConfig({
  srcDir: 'src',
  outDir: 'dist',
  manifestVersion: 3,
  imports: false,
  zip: { includeSources: REVIEWABLE_SOURCES },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      manifest.action = { ...manifest.action, default_icon: manifest.icons }
    },
  },
  vite: () => ({ plugins: [preact({ prefreshEnabled: false })] }),
  manifest: ({ browser }) => ({
    name: 'Highlights for ChatGPT',
    permissions: ['unlimitedStorage', 'alarms'],
    host_permissions: ['https://chatgpt.com/*'],
    action: { default_title: 'Open highlights' },
    commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+H' } } },
    ...(browser === 'firefox' ? FIREFOX_SETTINGS : CHROME_SETTINGS),
  }),
})
