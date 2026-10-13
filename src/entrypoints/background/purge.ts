import { browser } from 'wxt/browser'
import { DAY_MS, MINUTE_MS } from '@/model'
import { type PendingDatabase, purgeExpired } from '@/storage'
import { announceChange } from './announce'

export const PURGE_ALARM = 'purge'
const PURGE_PERIOD_MINUTES = DAY_MS / MINUTE_MS

export const runPurge = async (database: PendingDatabase): Promise<void> => {
  const removed = await purgeExpired(await database, Date.now())
  await announceChange(removed)
}

const scheduleDailyAlarm = async (): Promise<void> => {
  // Creating an alarm again resets its period
  if (await browser.alarms.get(PURGE_ALARM)) return
  await browser.alarms.create(PURGE_ALARM, { periodInMinutes: PURGE_PERIOD_MINUTES })
}

export const startPurge = async (database: PendingDatabase): Promise<void> => {
  browser.alarms.onAlarm.addListener(({ name }) => {
    if (name === PURGE_ALARM) return runPurge(database)
  })
  await scheduleDailyAlarm()
  await runPurge(database)
}
