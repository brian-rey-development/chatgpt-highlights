import type { Page } from '@playwright/test'
import { conversationUrl, MESSAGE_UNIT } from '@/chatgpt'
import { ANCHOR_MEASURE, JSON_MEDIA_TYPE } from '@/model'
import {
  FIRST_PHRASE,
  HIGHLIGHTS_PER_MESSAGE,
  LONG_CHAT_ID,
  LONG_CHAT_TITLE,
  longBackup,
  longThread,
  MESSAGE_COUNT,
  SECOND_PHRASE,
} from './chatgpt-page/long-thread'
import { expect, test } from './fixtures'
import { library, openLibrary, paintedTexts, SETTLE_FRAMES, waitFrames } from './page-actions'

const HIGHLIGHT_COUNT = MESSAGE_COUNT * HIGHLIGHTS_PER_MESSAGE
const ANCHOR_BUDGET_MS = 8
const ROUNDS = 5
const NO_OP_PASSES = 1
const BACKUP_FILE = { name: 'long-chat.json', mimeType: JSON_MEDIA_TYPE }

const restoreLongChat = async (page: Page): Promise<void> => {
  await openLibrary(page)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import backup' }).click()
  await (await chooser).setFiles({ ...BACKUP_FILE, buffer: Buffer.from(longBackup()) })
  await expect(page.getByRole('status')).toContainText(`Imported ${HIGHLIGHT_COUNT}`)
  await page.keyboard.press('Escape')
  await expect(library(page)).toHaveCount(0)
}

const anchorDurations = (page: Page): Promise<number[]> =>
  page.evaluate(
    (measure) => performance.getEntriesByName(measure).map((entry) => entry.duration),
    ANCHOR_MEASURE,
  )

const rebuildEveryMessage = async (page: Page): Promise<number[]> => {
  await page.evaluate(
    ({ unitSelector, measure }) => {
      performance.clearMeasures(measure)
      for (const unit of document.querySelectorAll(unitSelector)) {
        const paragraph = unit.querySelector('p')
        paragraph?.replaceChildren(document.createTextNode(paragraph.textContent ?? ''))
      }
    },
    { unitSelector: MESSAGE_UNIT, measure: ANCHOR_MEASURE },
  )
  await waitFrames(page, SETTLE_FRAMES)
  return anchorDurations(page)
}

test('anchors 100 highlights over 50 messages in under 8 ms per anchoring pass', async ({
  page,
  backend,
}) => {
  backend.serveThread(LONG_CHAT_ID, longThread(), LONG_CHAT_TITLE)
  await page.goto(conversationUrl(LONG_CHAT_ID))
  await restoreLongChat(page)
  await page.reload()
  await expect.poll(async () => (await paintedTexts(page)).length).toBe(HIGHLIGHT_COUNT)
  const loadDurations = await anchorDurations(page)
  expect(loadDurations.length).toBeGreaterThan(NO_OP_PASSES)
  expect(Math.max(...loadDurations)).toBeLessThan(ANCHOR_BUDGET_MS)
  const durations: number[] = []
  for (let round = 0; round < ROUNDS; round += 1) {
    const measured = await rebuildEveryMessage(page)
    expect(measured).toHaveLength(1)
    durations.push(...measured)
  }
  test.info().annotations.push({ type: `${ANCHOR_MEASURE} ms`, description: durations.join(', ') })
  expect(Math.max(...durations)).toBeLessThan(ANCHOR_BUDGET_MS)
  const painted = await paintedTexts(page)
  expect(painted).toHaveLength(HIGHLIGHT_COUNT)
  expect(new Set(painted)).toEqual(new Set([FIRST_PHRASE, SECOND_PHRASE]))
})
