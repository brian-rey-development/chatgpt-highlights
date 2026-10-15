import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fieldOf } from '@/model'
import { type Marionette, openMarionette } from './marionette'

const FIREFOX_CANDIDATES = [
  '/Applications/Firefox.app/Contents/MacOS/firefox',
  '/usr/bin/firefox',
  '/usr/local/bin/firefox',
]
const FORCE_QUIT_AFTER_MS = 5_000

export interface FirefoxSession {
  driver: Marionette
  installAddon: (directory: string) => Promise<string>
  navigate: (url: string) => Promise<void>
  evaluate: (script: string) => Promise<unknown>
  stop: () => Promise<void>
}

const findFirefox = (): string => {
  const { FIREFOX_BIN } = process.env
  const binary = [FIREFOX_BIN, ...FIREFOX_CANDIDATES].find(
    (path) => path !== undefined && existsSync(path),
  )
  if (binary) return binary
  throw new Error('Firefox was not found; install it or set FIREFOX_BIN to its executable')
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })

const profilePrefs = (marionettePort: number): string =>
  [
    ['marionette.port', marionettePort],
    ['network.dns.localDomains', 'chatgpt.com'],
    ['datareporting.policy.dataSubmissionEnabled', false],
    ['browser.shell.checkDefaultBrowser', false],
    ['app.update.auto', false],
  ]
    .map(([name, value]) => `user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`)
    .join('\n')

const spawnFirefox = (profile: string): ChildProcess =>
  spawn(
    findFirefox(),
    ['--marionette', '--headless', '--no-remote', '--profile', profile, 'about:blank'],
    { stdio: 'ignore' },
  )

const stopProcess = (firefox: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (firefox.exitCode !== null) return resolve()
    const forced = setTimeout(() => firefox.kill('SIGKILL'), FORCE_QUIT_AFTER_MS)
    firefox.once('exit', () => {
      clearTimeout(forced)
      resolve()
    })
    firefox.kill('SIGTERM')
  })

export const launchFirefox = async (): Promise<FirefoxSession> => {
  const profile = await mkdtemp(join(tmpdir(), 'hl-firefox-'))
  const marionettePort = await freePort()
  await writeFile(join(profile, 'user.js'), profilePrefs(marionettePort))
  const firefox = spawnFirefox(profile)
  const stop = async (): Promise<void> => {
    await stopProcess(firefox)
    await rm(profile, { recursive: true, force: true })
  }
  try {
    const driver = await openMarionette(marionettePort)
    await driver.send('WebDriver:NewSession', { acceptInsecureCerts: true })
    return {
      driver,
      stop: async () => {
        driver.close()
        await stop()
      },
      installAddon: async (path) =>
        String(fieldOf(await driver.send('Addon:Install', { path, temporary: true }), 'value')),
      navigate: async (url) => {
        await driver.send('WebDriver:Navigate', { url })
      },
      evaluate: async (script) =>
        fieldOf(await driver.send('WebDriver:ExecuteScript', { script, args: [] }), 'value'),
    }
  } catch (failure) {
    await stop()
    throw failure
  }
}
