import type { Locator, Page } from '@playwright/test'
import {
  COMPOSER,
  COMPOSER_FORM,
  MAIN,
  MESSAGE_ID_ATTR,
  NAV_ATTR,
  STOP_BUTTON_TEST_ID,
  TEST_ID_ATTR,
} from '@/chatgpt'
import { DEFAULT_COLOR, type HighlightColor, LIBRARY_LABEL } from '@/model'
import { FLASH_LAYER } from '@/painter'
import { FIRST_ANSWER_ID, HIGH_TIDE_QUOTE, LAST_ANSWER_ID, PULL_QUOTE } from '@/testing/fixture-ids'
import { expect } from './fixtures'

interface TextTarget {
  messageId: string
  text: string
}

interface Point {
  x: number
  y: number
}

const POLL_MS = 50

export const SETTLE_FRAMES = 3
export const PULL_TARGET: TextTarget = { messageId: FIRST_ANSWER_ID, text: PULL_QUOTE }
export const MOON_NOTE = 'Why the moon and not the sun?'
export const HIGH_TIDE_TARGET: TextTarget = { messageId: LAST_ANSWER_ID, text: HIGH_TIDE_QUOTE }

export const pill = (page: Page): Locator =>
  page.getByRole('toolbar', { name: 'Highlight selection' })

export const popover = (page: Page): Locator => page.getByRole('dialog', { name: 'Highlight' })

export const library = (page: Page): Locator => page.getByRole('region', { name: LIBRARY_LABEL })

export const libraryRow = (page: Page, quote: string): Locator =>
  library(page).getByRole('article').filter({ hasText: quote })

export const sidebarItem = (page: Page): Locator => page.locator(`[${NAV_ATTR}]`)

export const composer = (page: Page): Locator => page.locator(COMPOSER)

const pointOfText = (page: Page, target: TextTarget, select: boolean): Promise<Point> =>
  page.evaluate(
    ({ attr, messageId, text, select: shouldSelect }) => {
      const findTextNode = (root: Element): Text => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        for (let node = walker.nextNode(); node instanceof Text; node = walker.nextNode()) {
          nodes.push(node)
        }
        const found = nodes.find((node) => node.data.includes(text))
        if (!found) throw new Error(`message ${messageId} has no text ${text}`)
        return found
      }
      const rangeAround = (node: Text): Range => {
        const range = document.createRange()
        const at = node.data.indexOf(text)
        range.setStart(node, at)
        range.setEnd(node, at + text.length)
        return range
      }
      const release = (selected: Range): void => {
        document.getSelection()?.removeAllRanges()
        document.getSelection()?.addRange(selected)
        const host = selected.startContainer.parentElement
        host?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      }
      const unit = document.querySelector(`[${attr}="${messageId}"]`)
      if (!unit) throw new Error(`no message ${messageId}`)
      const range = rangeAround(findTextNode(unit))
      if (shouldSelect) release(range)
      const box = range.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    },
    { attr: MESSAGE_ID_ATTR, ...target, select },
  )

export const selectText = async (page: Page, target: TextTarget): Promise<void> => {
  await pointOfText(page, target, true)
}

export const offerPill = async (page: Page, target: TextTarget): Promise<void> => {
  await expect(sidebarItem(page)).toBeVisible()
  await selectText(page, target)
  await expect(pill(page)).toBeVisible()
}

export const clickOnText = async (page: Page, target: TextTarget): Promise<void> => {
  const point = await pointOfText(page, target, false)
  await page.mouse.click(point.x, point.y)
}

export const paintedTexts = (page: Page): Promise<string[]> =>
  page.evaluate(
    (flash) =>
      [...CSS.highlights]
        .filter(([name]) => name !== flash)
        .flatMap(([, layer]) => [...layer].map((range) => range.toString())),
    FLASH_LAYER,
  )

const flashedTexts = (page: Page): Promise<string[]> =>
  page.evaluate(
    (flash) => [...(CSS.highlights.get(flash) ?? [])].map((range) => range.toString()),
    FLASH_LAYER,
  )

const isPaintedInView = (page: Page, text: string): Promise<boolean> =>
  page.evaluate(
    ({ flash, main, painted }) => {
      const layers = [...CSS.highlights].filter(([name]) => name !== flash)
      const ranges = layers.flatMap(([, layer]) => [...layer])
      const range = ranges.find((r): r is Range => r instanceof Range && r.toString() === painted)
      const view = document.querySelector(main)?.getBoundingClientRect()
      if (!range || !view) return false
      const box = range.getBoundingClientRect()
      return box.top >= view.top && box.bottom <= view.bottom
    },
    { flash: FLASH_LAYER, main: MAIN, painted: text },
  )

export const expectPaintedInView = (page: Page, text: string): Promise<void> =>
  expect.poll(() => isPaintedInView(page, text), { intervals: [POLL_MS] }).toBe(true)

export const expectPaintedOutOfView = async (page: Page, text: string): Promise<void> => {
  expect(await isPaintedInView(page, text)).toBe(false)
}

export const leaveChatHiddenBesideHome = (page: Page): Promise<void> =>
  page.locator(MAIN).evaluate((chat, main) => {
    chat.toggleAttribute('hidden', true)
    chat.after(document.createElement(main))
  }, MAIN)

export const scrollMainToEnd = (page: Page): Promise<void> =>
  page.locator(MAIN).evaluate((main) => {
    main.scrollTop = main.scrollHeight
  })

export const expectPainted = (page: Page, text: string): Promise<void> =>
  expect.poll(() => paintedTexts(page), { intervals: [POLL_MS] }).toContain(text)

export const expectFlashed = (page: Page, text: string): Promise<void> =>
  expect.poll(() => flashedTexts(page), { intervals: [POLL_MS] }).toContain(text)

export const highlightSelection = async (
  page: Page,
  target: TextTarget & { color?: HighlightColor },
): Promise<void> => {
  await offerPill(page, target)
  await pill(page)
    .getByRole('button', { name: `Highlight ${target.color ?? DEFAULT_COLOR}` })
    .click()
  await expectPainted(page, target.text)
}

export const highlightWithNote = async (
  page: Page,
  target: TextTarget & { note: string },
): Promise<void> => {
  await offerPill(page, target)
  await pill(page).getByRole('button', { name: 'Highlight and add note' }).click()
  await popover(page).getByRole('textbox', { name: 'Note' }).fill(target.note)
}

export const openLibrary = async (page: Page): Promise<void> => {
  await sidebarItem(page).click()
  await expect(library(page)).toBeVisible()
}

export const setGenerating = (page: Page, generating: boolean): Promise<void> =>
  page.evaluate(
    ({ form, attr, id, on }) => {
      const composerForm = document.querySelector(form)
      composerForm?.querySelector(`[${attr}="${id}"]`)?.remove()
      if (!on) return
      const stop = document.createElement('button')
      stop.setAttribute(attr, id)
      stop.textContent = 'Stop'
      composerForm?.append(stop)
    },
    { form: COMPOSER_FORM, attr: TEST_ID_ATTR, id: STOP_BUTTON_TEST_ID, on: generating },
  )

export const waitFrames = (page: Page, frames: number): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        const wait = (left: number): void => {
          if (left === 0) resolve()
          else requestAnimationFrame(() => wait(left - 1))
        }
        wait(count)
      }),
    frames,
  )

export const openExportMenu = async (page: Page): Promise<void> => {
  await library(page).getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
}
