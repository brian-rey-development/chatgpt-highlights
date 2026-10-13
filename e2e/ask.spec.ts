import { conversationUrl } from '@/chatgpt'
import { toBlockquote } from '@/markdown'
import { FIXTURE_CONVERSATION_ID, OTHER_CONVERSATION_ID, PULL_QUOTE } from '@/testing/fixture-ids'
import { NATIVE_QUOTE_ATTR } from './chatgpt-page/page'
import { storedHighlights } from './extension-data'
import { expect, test } from './fixtures'
import {
  composer,
  highlightWithNote,
  library,
  libraryRow,
  openLibrary,
  PULL_TARGET,
  popover,
} from './page-actions'

const NOTE = 'Why does the moon dominate?'
const NATIVE_QUOTE = `[${NATIVE_QUOTE_ATTR}]`

test('drives the native ask box from a painted highlight and pastes the note', async ({ page }) => {
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await highlightWithNote(page, { ...PULL_TARGET, note: NOTE })
  await popover(page).getByRole('button', { name: 'Ask about this' }).click()
  await expect(page.locator(NATIVE_QUOTE)).toHaveText(PULL_QUOTE)
  await expect(composer(page)).toContainText(NOTE)
  await expect(popover(page)).toHaveCount(0)
})

test('pastes the quote and the note when the highlight belongs to another chat', async ({
  page,
  serviceWorker,
}) => {
  await page.goto(conversationUrl(OTHER_CONVERSATION_ID))
  await highlightWithNote(page, { ...PULL_TARGET, note: NOTE })
  await expect.poll(async () => (await storedHighlights(serviceWorker))[0]?.note).toBe(NOTE)
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await openLibrary(page)
  const row = libraryRow(page, PULL_QUOTE)
  await row.hover()
  await row.getByRole('button', { name: 'Ask about this' }).click()
  await expect(library(page)).toHaveCount(0)
  await expect(composer(page)).toContainText(toBlockquote(PULL_QUOTE))
  await expect(composer(page)).toContainText(NOTE)
  await expect(page.locator(NATIVE_QUOTE)).toHaveCount(0)
})
