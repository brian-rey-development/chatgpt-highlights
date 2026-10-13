import { ASK_BOX, conversationUrl, TEMPORARY_CHAT_ON, TEMPORARY_CHAT_PARAM } from '@/chatgpt'
import { PILL_DOCK_GAP_PX, TEMPORARY_CHAT_MESSAGE } from '@/model'
import { FIXTURE_CONVERSATION_ID, PULL_QUOTE } from '@/testing/fixture-ids'
import { FIXTURE_FONT, TEXT_COLORS } from './chatgpt-page/page'
import { storedHighlights } from './extension-data'
import { expect, test } from './fixtures'
import {
  clickOnText,
  expectPainted,
  highlightSelection,
  highlightWithNote,
  MOON_NOTE,
  offerPill,
  PULL_TARGET,
  pill,
  popover,
  SETTLE_FRAMES,
  selectText,
  setGenerating,
  sidebarItem,
  waitFrames,
} from './page-actions'

const TAG = 'physics'

const CHAT_URL = conversationUrl(FIXTURE_CONVERSATION_ID)

test.beforeEach(async ({ page }) => {
  await page.goto(CHAT_URL)
})

test('offers no pill in a temporary chat and says why', async ({ page }) => {
  await page.goto(`${CHAT_URL}?${TEMPORARY_CHAT_PARAM}=${TEMPORARY_CHAT_ON}`)
  await expect(sidebarItem(page)).toBeVisible()
  await selectText(page, PULL_TARGET)
  await expect(page.getByRole('status')).toHaveText(TEMPORARY_CHAT_MESSAGE)
  await waitFrames(page, SETTLE_FRAMES)
  await expect(pill(page)).toHaveCount(0)
})

test('paints a highlight again after a reload', async ({ page }) => {
  await highlightSelection(page, PULL_TARGET)
  await page.reload()
  await expectPainted(page, PULL_QUOTE)
})

test('renders the overlay with its bundled styles', async ({ page, theme }) => {
  await offerPill(page, PULL_TARGET)
  const box = await pill(page).boundingBox()
  expect(box?.width).toBeGreaterThan(0)
  await expect(pill(page)).toHaveCSS('position', 'fixed')
  await expect(pill(page)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(pill(page)).toHaveCSS('color', TEXT_COLORS[theme])
  await expect(pill(page)).toHaveCSS('font-family', new RegExp(FIXTURE_FONT))
})

test('styles the popover with the page font and text color', async ({ page, theme }) => {
  await highlightWithNote(page, { ...PULL_TARGET, note: MOON_NOTE })
  await expect(popover(page)).toHaveCSS('color', TEXT_COLORS[theme])
  await expect(popover(page)).toHaveCSS('font-family', new RegExp(FIXTURE_FONT))
})

test('closes the popover with its Close button and keeps the typed note', async ({
  page,
  serviceWorker,
}) => {
  await highlightWithNote(page, { ...PULL_TARGET, note: MOON_NOTE })
  await popover(page).getByRole('button', { name: 'Close' }).click()
  await expect(popover(page)).toHaveCount(0)
  await expect.poll(async () => (await storedHighlights(serviceWorker))[0]?.note).toBe(MOON_NOTE)
  await clickOnText(page, PULL_TARGET)
  await expect(popover(page).getByRole('textbox', { name: 'Note' })).toHaveValue(MOON_NOTE)
})

test('keeps the note and tags after a reload', async ({ page, serviceWorker }) => {
  await highlightWithNote(page, { ...PULL_TARGET, note: MOON_NOTE })
  await popover(page).getByRole('textbox', { name: 'Add tag' }).fill(TAG)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await storedHighlights(serviceWorker))[0]?.tags).toEqual([TAG])
  await expect.poll(async () => (await storedHighlights(serviceWorker))[0]?.note).toBe(MOON_NOTE)
  await page.reload()
  await expectPainted(page, PULL_QUOTE)
  await clickOnText(page, PULL_TARGET)
  await expect(popover(page).getByRole('textbox', { name: 'Note' })).toHaveValue(MOON_NOTE)
  await expect(popover(page)).toContainText(`#${TAG}`)
})

test('offers no pill while a reply is generating', async ({ page }) => {
  await expect(sidebarItem(page)).toBeVisible()
  await setGenerating(page, true)
  await selectText(page, PULL_TARGET)
  await waitFrames(page, SETTLE_FRAMES)
  await expect(pill(page)).toHaveCount(0)
  await setGenerating(page, false)
  await offerPill(page, PULL_TARGET)
})

test('docks the pill to the right of the native ask box after the box moves', async ({ page }) => {
  await offerPill(page, PULL_TARGET)
  await waitFrames(page, SETTLE_FRAMES)
  await expect
    .poll(async () => {
      const box = await page.locator(ASK_BOX).boundingBox()
      const dock = await pill(page).boundingBox()
      if (!(box && dock)) return null
      return { gap: Math.round(dock.x - (box.x + box.width)), top: Math.round(dock.y - box.y) }
    })
    .toEqual({ gap: PILL_DOCK_GAP_PX, top: 0 })
})
