import { describe, expect, it } from 'vitest'
import { installFakeDownload } from './download'

const save = (name: string, text: string): void => {
  const link = document.createElement('a')
  link.download = name
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  link.click()
  URL.revokeObjectURL(link.href)
}

describe('installFakeDownload', () => {
  it('records the name, type and text of each downloaded blob', async () => {
    const downloads = installFakeDownload()
    save('first.txt', 'one')
    save('second.txt', 'two')
    expect(downloads.files.map((file) => [file.name, file.type])).toEqual([
      ['first.txt', 'text/plain'],
      ['second.txt', 'text/plain'],
    ])
    expect(await downloads.files[1]?.text()).toBe('two')
  })

  it('records the object urls that were released', () => {
    const downloads = installFakeDownload()
    save('first.txt', 'one')
    expect(downloads.revoked).toEqual(['blob:fake/0'])
  })

  it('ignores a click on a link that does not point at a created blob', () => {
    const downloads = installFakeDownload()
    document.createElement('a').click()
    expect(downloads.files).toEqual([])
  })
})
