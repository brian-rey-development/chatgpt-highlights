import { describe, expect, it, vi } from 'vitest'
import { clearJump, JUMP_STORAGE_KEY, loadJump, saveJump } from './jump'

const JUMP = { conversationId: 'conversation-1', highlightId: 'highlight-1' }

describe('saveJump and loadJump', () => {
  it('round-trips the target', () => {
    saveJump(JUMP)
    expect(loadJump()).toEqual(JUMP)
  })

  it('is empty until something is saved and after it is cleared', () => {
    expect(loadJump()).toBeNull()
    saveJump(JUMP)
    clearJump()
    expect(loadJump()).toBeNull()
  })

  it('keeps the target in the tab session under a key of the product', () => {
    saveJump(JUMP)
    expect(JSON.parse(sessionStorage.getItem(JUMP_STORAGE_KEY) ?? 'null')).toEqual(JUMP)
    expect(JUMP_STORAGE_KEY).toBe('chatgpt-highlights:jump')
  })

  it.each([
    { name: 'text that is not JSON', raw: 'not json' },
    { name: 'a value that is not an object', raw: '42' },
    { name: 'a missing highlight id', raw: '{"conversationId":"c"}' },
    { name: 'a conversation id that is not text', raw: '{"conversationId":1,"highlightId":"h"}' },
  ])('ignores $name left in the storage by the page', ({ raw }) => {
    sessionStorage.setItem(JUMP_STORAGE_KEY, raw)
    expect(loadJump()).toBeNull()
  })
})

describe('a storage the page refuses', () => {
  const REFUSAL = new DOMException('blocked', 'SecurityError')

  it('does not throw when the jump cannot be remembered', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw REFUSAL
    })
    expect(() => saveJump(JUMP)).not.toThrow()
  })

  it('reads as no jump and does not throw when the storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw REFUSAL
    })
    expect(loadJump()).toBeNull()
  })

  it('does not throw when the jump cannot be cleared', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw REFUSAL
    })
    expect(() => clearJump()).not.toThrow()
  })
})
