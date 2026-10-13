import type { Worker } from '@playwright/test'
import type { Highlight } from '@/model'
import { DATABASE_NAME, DATABASE_VERSION } from '@/storage'

const DATABASE = { name: DATABASE_NAME, version: DATABASE_VERSION }

export const storedHighlights = (serviceWorker: Worker): Promise<Highlight[]> =>
  serviceWorker.evaluate(
    ({ name, version }) =>
      new Promise<Highlight[]>((resolve, reject) => {
        const opening = indexedDB.open(name, version)
        opening.onupgradeneeded = () => opening.transaction?.abort()
        opening.onerror = () => reject(opening.error)
        opening.onsuccess = () => {
          const reading = opening.result.transaction('highlights').objectStore('highlights')
          const all = reading.getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => reject(all.error)
        }
      }),
    DATABASE,
  )

export const ageStatusChecks = (serviceWorker: Worker): Promise<void> =>
  serviceWorker.evaluate(
    ({ name, version }) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open(name, version)
        opening.onupgradeneeded = () => opening.transaction?.abort()
        opening.onerror = () => reject(opening.error)
        opening.onsuccess = () => {
          const tx = opening.result.transaction('conversations', 'readwrite')
          const store = tx.objectStore('conversations')
          const all = store.getAll()
          all.onsuccess = () => {
            for (const conversation of all.result) store.put({ ...conversation, checkedAt: 0 })
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    DATABASE,
  )
