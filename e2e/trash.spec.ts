import { conversationUrl, STATUS_MISSING, STATUS_OK } from '@/chatgpt'
import { MOVED_TO_TRASH_MESSAGE, TRASH_LABEL } from '@/model'
import { FIXTURE_CONVERSATION_ID, OTHER_CONVERSATION_ID } from '@/testing/fixture-ids'
import { ageStatusChecks, storedHighlights } from './extension-data'
import { expect, test } from './fixtures'
import { OTHER_CONVERSATION_TITLE } from './mock-backend'
import { highlightSelection, library, openLibrary, PULL_TARGET } from './page-actions'

test('moves a deleted chat to Recently deleted and brings it back when it returns', async ({
  page,
  serviceWorker,
  backend,
}) => {
  await page.goto(conversationUrl(OTHER_CONVERSATION_ID))
  await highlightSelection(page, PULL_TARGET)
  await expect.poll(async () => (await storedHighlights(serviceWorker)).length).toBe(1)
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await ageStatusChecks(serviceWorker)
  backend.respondToConversation(OTHER_CONVERSATION_ID, STATUS_MISSING)
  await openLibrary(page)
  const trash = library(page).getByRole('region', { name: TRASH_LABEL })
  await expect(trash).toContainText(OTHER_CONVERSATION_TITLE)
  await expect(page.getByRole('status')).toHaveText(MOVED_TO_TRASH_MESSAGE)
  backend.respondToConversation(OTHER_CONVERSATION_ID, STATUS_OK)
  await ageStatusChecks(serviceWorker)
  await page.keyboard.press('Escape')
  await expect(library(page)).toHaveCount(0)
  await openLibrary(page)
  await expect(library(page).getByRole('region', { name: OTHER_CONVERSATION_TITLE })).toBeVisible()
  await expect(trash).toHaveCount(0)
})
