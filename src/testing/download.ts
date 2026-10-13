import { vi } from 'vitest'

export interface DownloadedFile {
  name: string
  type: string
  text: () => Promise<string>
}

export interface FakeDownloads {
  files: DownloadedFile[]
  revoked: string[]
}

const BLOB_URL_PREFIX = 'blob:fake/'

export const installFakeDownload = (): FakeDownloads => {
  const blobs = new Map<string, Blob>()
  const downloads: FakeDownloads = { files: [], revoked: [] }
  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => {
    const url = `${BLOB_URL_PREFIX}${blobs.size}`
    if (!(object instanceof Blob)) throw new Error('only blobs become object urls')
    blobs.set(url, object)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    downloads.revoked.push(url)
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href)
    if (blob)
      downloads.files.push({ name: this.download, type: blob.type, text: () => blob.text() })
  })
  return downloads
}
