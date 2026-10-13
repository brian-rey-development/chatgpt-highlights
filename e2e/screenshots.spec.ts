import { resolve } from 'node:path'
import { conversationUrl } from '@/chatgpt'
import { FIXTURE_CONVERSATION_ID } from '@/testing/fixture-ids'
import { storedHighlights } from './extension-data'
import { expect, test } from './fixtures'
import {
  HIGH_TIDE_TARGET,
  highlightSelection,
  MOON_NOTE,
  offerPill,
  openLibrary,
  PULL_TARGET,
  popover,
  SETTLE_FRAMES,
  waitFrames,
} from './page-actions'

const SCREENSHOT_DIR = resolve(import.meta.dirname, '../test-results/screenshots')

test('captures the pill, the popover and the library for review', async ({
  page,
  theme,
  serviceWorker,
}) => {
  const shoot = async (name: string) => {
    await waitFrames(page, SETTLE_FRAMES)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, `${theme}-${name}.png`) })
  }
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await highlightSelection(page, { ...HIGH_TIDE_TARGET, color: 'blue' })
  await offerPill(page, PULL_TARGET)
  await shoot('pill')
  await page.getByRole('button', { name: 'Highlight and add note' }).click()
  await popover(page).getByRole('textbox', { name: 'Note' }).fill(MOON_NOTE)
  await popover(page).getByRole('textbox', { name: 'Add tag' }).fill('physics')
  await page.keyboard.press('Enter')
  await shoot('popover')
  await expect
    .poll(async () => (await storedHighlights(serviceWorker)).map((row) => row.note))
    .toContain(MOON_NOTE)
  await page.keyboard.press('Escape')
  await openLibrary(page)
  await shoot('library')
})
