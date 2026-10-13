import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SLUG } from '@/model'
import { installFakeDownload } from '@/testing'
import { downloadFile, exportFileName, REVOKE_DELAY_MS } from './download'

const LOCAL_DAY = new Date(2026, 9, 12, 12).getTime()
const EARLY_DAY = new Date(2026, 0, 5, 12).getTime()
const US_STYLE_DATE = '10/12/2026'

beforeEach(() => vi.useFakeTimers())

describe('exportFileName', () => {
  it('names the file after the product, the local day and the format', () => {
    expect(exportFileName('md', LOCAL_DAY)).toBe(`${APP_SLUG}-2026-10-12.md`)
    expect(exportFileName('json', LOCAL_DAY)).toBe(`${APP_SLUG}-2026-10-12.json`)
  })

  it('pads single-digit months and days', () => {
    expect(exportFileName('md', EARLY_DAY)).toBe(`${APP_SLUG}-2026-01-05.md`)
  })

  it('dates the file YYYY-MM-DD whatever the locale data says', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue(US_STYLE_DATE)
    expect(exportFileName('md', LOCAL_DAY)).toBe(`${APP_SLUG}-2026-10-12.md`)
  })
})

describe('downloadFile', () => {
  it('saves the text under the given name and type', async () => {
    const downloads = installFakeDownload()
    downloadFile(document, { name: 'notes.md', text: '# Notes', type: 'text/markdown' })
    expect(downloads.files).toHaveLength(1)
    expect(downloads.files[0]).toMatchObject({ name: 'notes.md', type: 'text/markdown' })
    expect(await downloads.files[0]?.text()).toBe('# Notes')
  })

  it('releases the object url shortly after the save started', async () => {
    const downloads = installFakeDownload()
    downloadFile(document, { name: 'notes.md', text: '', type: 'text/markdown' })
    expect(downloads.revoked).toEqual([])
    await vi.advanceTimersByTimeAsync(REVOKE_DELAY_MS)
    expect(downloads.revoked).toHaveLength(1)
  })

  it('leaves the page untouched', () => {
    installFakeDownload()
    const before = document.body.innerHTML
    downloadFile(document, { name: 'notes.md', text: '', type: 'text/markdown' })
    expect(document.body.innerHTML).toBe(before)
  })
})
