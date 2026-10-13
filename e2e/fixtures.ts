import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  type BrowserContext,
  test as base,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test'
import { ASK_BOX, COMPOSER, COMPOSER_FORM, MAIN, MESSAGE_UNIT } from '@/chatgpt'
import { type BehaviorConfig, installBehavior } from './chatgpt-page/behavior'
import { NATIVE_QUOTE_ATTR, SCROLL_RESTORE_DELAY_MS, type Theme } from './chatgpt-page/page'
import { installBackend, type MockBackend } from './mock-backend'

const EXTENSION_PATH = resolve(import.meta.dirname, '../dist/chrome-mv3-e2e')
const VIEWPORT = { width: 1280, height: 800 }

const BEHAVIOR: BehaviorConfig = {
  askBox: ASK_BOX,
  composer: COMPOSER,
  composerForm: COMPOSER_FORM,
  main: MAIN,
  messageUnit: MESSAGE_UNIT,
  nativeQuoteAttr: NATIVE_QUOTE_ATTR,
  scrollRestoreDelayMs: SCROLL_RESTORE_DELAY_MS,
}

export interface ThemeOption {
  theme: Theme
}

interface Fixtures {
  context: BrowserContext
  serviceWorker: Worker
  backend: MockBackend
  page: Page
}

const launchWithExtension = (profile: string, headless: boolean): Promise<BrowserContext> =>
  chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless,
    viewport: VIEWPORT,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  })

export const test = base.extend<Fixtures & ThemeOption>({
  theme: ['light', { option: true }],
  context: async ({ headless }, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'hl-e2e-'))
    const context = await launchWithExtension(profile, headless)
    await context.addInitScript(installBehavior, BEHAVIOR)
    await use(context)
    await context.close()
    await rm(profile, { recursive: true, force: true })
  },
  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers()
    await use(existing ?? (await context.waitForEvent('serviceworker')))
  },
  backend: [
    async ({ context, theme }, use) => {
      await use(await installBackend(context, theme))
    },
    { auto: true },
  ],
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()))
  },
})

export const { expect } = test
