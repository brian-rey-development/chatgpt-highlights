import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/model'

const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365
const WEEK_MS = DAYS_PER_WEEK * DAY_MS
const MONTH_MS = DAYS_PER_MONTH * DAY_MS
const YEAR_MS = DAYS_PER_YEAR * DAY_MS

const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', YEAR_MS],
  ['month', MONTH_MS],
  ['week', WEEK_MS],
  ['day', DAY_MS],
  ['hour', HOUR_MS],
  ['minute', MINUTE_MS],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const capitalize = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

export const timeAgo = (then: number, now: number): string => {
  const elapsed = Math.max(0, now - then)
  const match = UNITS.find(([, unitMs]) => elapsed >= unitMs)
  if (match === undefined) return 'Just now'
  const [unit, size] = match
  return capitalize(formatter.format(-Math.floor(elapsed / size), unit))
}
