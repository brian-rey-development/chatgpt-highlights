import { readFile } from 'node:fs/promises'
import { conversationUrl } from '@/chatgpt'
import { APP_SLUG } from '@/model'
import { FIXTURE_CONVERSATION_ID, PULL_QUOTE } from '@/testing/fixture-ids'
import { expect, test } from './fixtures'
import {
  highlightSelection,
  library,
  openExportMenu,
  openLibrary,
  PULL_TARGET,
} from './page-actions'

const MARKDOWN_NAME = new RegExp(`^${APP_SLUG}-\\d{4}-\\d{2}-\\d{2}\\.md$`)

test.beforeEach(async ({ page }) => {
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await highlightSelection(page, PULL_TARGET)
  await openLibrary(page)
})

test('closes the Export menu on the first Escape and the view on the second', async ({ page }) => {
  await openExportMenu(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(library(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(library(page)).toHaveCount(0)
})

test('downloads a Markdown file that contains the quote', async ({ page }) => {
  await openExportMenu(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Markdown' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(MARKDOWN_NAME)
  const path = await download.path()
  expect(await readFile(path, 'utf8')).toContain(PULL_QUOTE)
})
