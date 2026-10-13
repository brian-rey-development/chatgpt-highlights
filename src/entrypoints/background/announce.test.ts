import { describe, expect, it } from 'vitest'
import { dataChanged, FAKE_TAB_ID, installFakeTabs } from '@/testing'
import { announceChange } from './announce'

const SECOND_TAB_ID = 4

describe('announceChange', () => {
  it('sends data.changed with the conversation ids to every chatgpt tab', async () => {
    const sent = installFakeTabs([{ id: FAKE_TAB_ID }, { id: SECOND_TAB_ID }])
    await announceChange(['a', 'b'])
    const event = dataChanged('a', 'b')
    expect(sent).toEqual([
      { tabId: FAKE_TAB_ID, message: event },
      { tabId: SECOND_TAB_ID, message: event },
    ])
  })

  it('sends nothing when no conversation was touched', async () => {
    const sent = installFakeTabs([{ id: FAKE_TAB_ID }])
    await announceChange([])
    expect(sent).toEqual([])
  })
})
