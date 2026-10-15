import { describe, expect, it } from 'vitest'
import { mountFixture, rangeOver, requireElement } from '@/testing'
import { visibleText } from './visible-text'

describe('visibleText', () => {
  it('reads the text a reader sees and leaves out buttons and hidden markup', () => {
    mountFixture('<p>Read <button>Copy</button><span aria-hidden="true">x</span>this</p>')
    expect(visibleText(rangeOver(requireElement('p')))).toBe('Read this')
  })

  it('does not change the document it reads from', () => {
    mountFixture('<p>Read <button>Copy</button>this</p>')
    visibleText(rangeOver(requireElement('p')))
    expect(requireElement('p').textContent).toBe('Read Copythis')
  })
})
