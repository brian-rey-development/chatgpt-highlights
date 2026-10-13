import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeClipboard, installFakeClipboardWriter, recordPastes } from './clipboard'

beforeEach(installFakeClipboard)

describe('installFakeClipboard', () => {
  it('stores data by type and answers an empty string for an unknown type', () => {
    const data = new DataTransfer()
    data.setData('text/plain', 'quote')
    expect(data.getData('text/plain')).toBe('quote')
    expect(data.getData('text/html')).toBe('')
  })

  it('carries the transfer on a paste event', () => {
    const clipboardData = new DataTransfer()
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true })
    expect(event.clipboardData).toBe(clipboardData)
    expect(event.bubbles).toBe(true)
  })

  it('carries no transfer when none is given', () => {
    expect(new ClipboardEvent('paste').clipboardData).toBeNull()
  })
})

describe('installFakeClipboardWriter', () => {
  it('collects what was written to the clipboard', async () => {
    const written = installFakeClipboardWriter()
    await navigator.clipboard.writeText('one')
    await navigator.clipboard.writeText('two')
    expect(written).toEqual(['one', 'two'])
  })

  it('collects nothing when the clipboard refuses', async () => {
    const written = installFakeClipboardWriter(() => Promise.reject(new Error('denied')))
    await expect(navigator.clipboard.writeText('one')).rejects.toThrow('denied')
    expect(written).toEqual([])
  })
})

describe('recordPastes', () => {
  it('collects the plain text of every paste on the element', () => {
    const target = document.createElement('div')
    const pasted = recordPastes(target)
    for (const text of ['one', 'two']) {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', text)
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData }))
    }
    target.dispatchEvent(new ClipboardEvent('paste'))
    target.dispatchEvent(new Event('paste'))
    expect(pasted).toEqual(['one', 'two', ''])
  })
})
