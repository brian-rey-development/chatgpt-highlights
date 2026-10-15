import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { conversationUrl } from '@/chatgpt'
import { APP_SLUG, fieldOf } from '@/model'
import { FIXTURE_CONVERSATION_ID } from '@/testing/fixture-ids'
import { type FirefoxSession, launchFirefox } from './firefox-session'
import { type FixtureServer, startFixtureServer } from './fixture-server'

const EXTENSION_PATH = resolve(import.meta.dirname, '../../dist/firefox-mv3')
const MOUNT_TIMEOUT_MS = 15_000

const geckoIdOf = (): string => {
  const manifest: unknown = JSON.parse(
    readFileSync(resolve(EXTENSION_PATH, 'manifest.json'), 'utf8'),
  )
  const settings = fieldOf(manifest, 'browser_specific_settings')
  return String(fieldOf(fieldOf(settings, 'gecko'), 'id'))
}

const overlayHosts = (session: FirefoxSession): Promise<unknown> =>
  session.evaluate(`return document.querySelectorAll(${JSON.stringify(APP_SLUG)}).length`)

let server: FixtureServer
let firefox: FirefoxSession

test.beforeAll(async () => {
  server = await startFixtureServer(conversationUrl(FIXTURE_CONVERSATION_ID))
  firefox = await launchFirefox()
})

test.afterAll(async () => {
  await firefox?.stop()
  await server?.stop()
})

test('installs the Firefox build and mounts its overlay on a chatgpt.com page', async () => {
  expect(await firefox.installAddon(EXTENSION_PATH)).toBe(geckoIdOf())
  await firefox.navigate(server.url)
  await expect.poll(() => overlayHosts(firefox), { timeout: MOUNT_TIMEOUT_MS }).toBe(1)
})
