import { conversationUrl } from '@/chatgpt'
import { FIXTURE_CONVERSATION_ID, PULL_QUOTE } from '@/testing/fixture-ids'
import { expect, test } from './fixtures'
import {
  expectPainted,
  PULL_TARGET,
  pill,
  popover,
  selectTextWithoutPointer,
  sidebarItem,
} from './page-actions'

const COLOR_COUNT = 5

test.beforeEach(async ({ page }) => {
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await expect(sidebarItem(page)).toBeVisible()
  await selectTextWithoutPointer(page, PULL_TARGET)
  await expect(pill(page)).toBeVisible()
})

test('highlights a selection made without the pointer using Tab and Enter', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(pill(page).getByRole('button', { name: 'Highlight yellow' })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expectPainted(page, PULL_QUOTE)
})

test('opens the note from the last pill button with Space', async ({ page }) => {
  for (let press = 0; press <= COLOR_COUNT; press += 1) await page.keyboard.press('Tab')
  await expect(pill(page).getByRole('button', { name: 'Highlight and add note' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(popover(page).getByRole('textbox', { name: 'Note' })).toBeVisible()
})

test('dismisses the pill with Escape', async ({ page }) => {
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(pill(page)).toHaveCount(0)
})
