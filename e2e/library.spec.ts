import type { Page } from '@playwright/test'
import { conversationUrl, INERT_ATTR, LIBRARY_URL, MAIN } from '@/chatgpt'
import { SEARCH_LABEL } from '@/model'
import {
  FIXTURE_CONVERSATION_ID,
  HIGH_TIDE_QUOTE,
  OTHER_CONVERSATION_ID,
  PULL_QUOTE,
} from '@/testing/fixture-ids'
import { FIXTURE_FONT, SCROLL_RESTORE_DELAY_MS, TEXT_COLORS } from './chatgpt-page/page'
import { expect, test } from './fixtures'
import { OTHER_CONVERSATION_TITLE } from './mock-backend'
import {
  expectFlashed,
  expectPainted,
  expectPaintedInView,
  expectPaintedOutOfView,
  HIGH_TIDE_TARGET,
  highlightSelection,
  leaveChatHiddenBesideHome,
  library,
  libraryRow,
  openLibrary,
  PULL_TARGET,
  scrollMainToEnd,
  sidebarItem,
} from './page-actions'

const SHORT_VIEWPORT = { width: 1280, height: 320 }

const openRow = (page: Page, quote: string) =>
  libraryRow(page, quote)
    .getByRole('button', { name: new RegExp(quote) })
    .first()
    .click()

test.beforeEach(async ({ page }) => {
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await highlightSelection(page, PULL_TARGET)
  await highlightSelection(page, HIGH_TIDE_TARGET)
})

test('opens the Highlights view over the main pane', async ({ page }) => {
  await expect(sidebarItem(page)).toHaveText('Highlights')
  await openLibrary(page)
  await expect(page.locator(MAIN)).toHaveAttribute(INERT_ATTR, '')
  const main = await page.locator(MAIN).boundingBox()
  const view = await library(page).boundingBox()
  expect(view).toEqual(main)
})

test('opens over the visible main when the chat main stays mounted but hidden', async ({
  page,
}) => {
  await leaveChatHiddenBesideHome(page)
  await openLibrary(page)
  await expect(page.locator(MAIN).last()).toHaveAttribute(INERT_ATTR, '')
  await expect(page.locator(MAIN).first()).not.toHaveAttribute(INERT_ATTR, '')
  expect(await library(page).boundingBox()).toEqual(await page.locator(MAIN).last().boundingBox())
})

test('opens at the root address over the chat and returns to it on Back', async ({ page }) => {
  await openLibrary(page)
  await expect(page).toHaveURL(LIBRARY_URL)
  expect(new URL(page.url()).pathname).toBe('/')
  await expectPainted(page, PULL_QUOTE)
  await page.goBack()
  await expect(page).toHaveURL(conversationUrl(FIXTURE_CONVERSATION_ID))
  await expect(library(page)).toHaveCount(0)
})

test('styles the view with the page font and text color', async ({ page, theme }) => {
  await openLibrary(page)
  const title = library(page).getByRole('heading', { name: 'Highlights', level: 1 })
  await expect(title).toHaveCSS('font-family', new RegExp(FIXTURE_FONT))
  await expect(title).toHaveCSS('color', TEXT_COLORS[theme])
})

test('filters the rows by the search text', async ({ page }) => {
  await openLibrary(page)
  await expect(libraryRow(page, PULL_QUOTE)).toBeVisible()
  await expect(libraryRow(page, HIGH_TIDE_QUOTE)).toBeVisible()
  await library(page).getByRole('textbox', { name: SEARCH_LABEL }).fill('gravitational')
  await expect(libraryRow(page, PULL_QUOTE)).toBeVisible()
  await expect(libraryRow(page, HIGH_TIDE_QUOTE)).toHaveCount(0)
})

test('jumps to a highlight of this chat and flashes it', async ({ page }) => {
  await openLibrary(page)
  await openRow(page, PULL_QUOTE)
  await expect(library(page)).toHaveCount(0)
  await expectFlashed(page, PULL_QUOTE)
})

test('keeps a highlight of this chat in view once the view has closed', async ({ page }) => {
  await page.setViewportSize(SHORT_VIEWPORT)
  await scrollMainToEnd(page)
  await expectPaintedOutOfView(page, PULL_QUOTE)
  await openLibrary(page)
  await openRow(page, PULL_QUOTE)
  await expect(page).toHaveURL(conversationUrl(FIXTURE_CONVERSATION_ID))
  await page.waitForTimeout(SCROLL_RESTORE_DELAY_MS * 2)
  await expectPaintedInView(page, PULL_QUOTE)
})

test('opens the chat of a highlight from another chat and flashes it', async ({ page }) => {
  await page.goto(conversationUrl(OTHER_CONVERSATION_ID))
  await highlightSelection(page, PULL_TARGET)
  await page.goto(conversationUrl(FIXTURE_CONVERSATION_ID))
  await openLibrary(page)
  await library(page)
    .getByRole('region', { name: OTHER_CONVERSATION_TITLE })
    .getByRole('button', { name: new RegExp(PULL_QUOTE) })
    .first()
    .click()
  await expect(page).toHaveURL(conversationUrl(OTHER_CONVERSATION_ID))
  await expectFlashed(page, PULL_QUOTE)
})
