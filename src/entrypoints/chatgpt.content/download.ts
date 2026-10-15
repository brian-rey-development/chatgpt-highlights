import { APP_SLUG } from '@/model'

interface DownloadFile {
  name: string
  text: string
  type: string
}

export const REVOKE_DELAY_MS = 1_000
const DATE_PART_WIDTH = 2
const MONTH_NUMBER_OFFSET = 1

const twoDigits = (value: number): string => String(value).padStart(DATE_PART_WIDTH, '0')

const dateStamp = (now: number): string => {
  const day = new Date(now)
  const month = twoDigits(day.getMonth() + MONTH_NUMBER_OFFSET)
  return `${day.getFullYear()}-${month}-${twoDigits(day.getDate())}`
}

export const exportFileName = (extension: 'md' | 'json', now: number): string =>
  `${APP_SLUG}-${dateStamp(now)}.${extension}`

export const downloadFile = (doc: Document, file: DownloadFile): void => {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }))
  const link = doc.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
