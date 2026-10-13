import { conversationLink, conversationUrl } from '@/chatgpt'
import { highlightToMarkdown, type MarkdownGroup, renderMarkdown } from '@/markdown'
import { request } from '@/messaging'
import {
  COPIED_MESSAGE,
  type Highlight,
  type ImportReport,
  JSON_MEDIA_TYPE,
  type Snapshot,
} from '@/model'
import type { UiActions } from '@/ui'
import { downloadFile, exportFileName } from './download'
import { type Jump, saveJump } from './jump'
import type { LibraryHost } from './library-host'
import type { Reveal } from './reveal'
import { type Runtime, showFailure, showMessage } from './store'

type LibraryActions = Pick<
  UiActions,
  | 'closeLibrary'
  | 'jumpTo'
  | 'copyMarkdown'
  | 'exportMarkdown'
  | 'exportBackup'
  | 'importBackup'
  | 'purgeConversation'
>

export const COPY_FAILED_MESSAGE = "Couldn't copy to the clipboard"
export const READ_FAILED_MESSAGE = "Couldn't read that file"

const MARKDOWN_TYPE = 'text/markdown'

export const importedMessage = ({ added, updated, skipped }: ImportReport): string =>
  `Imported ${added}, updated ${updated}, skipped ${skipped}`

const groupsOf = (snapshot: Snapshot | undefined, highlights: readonly Highlight[]) => {
  const titles = new Map(snapshot?.conversations.map(({ id, title }) => [id, title]))
  return [...Map.groupBy(highlights, (highlight) => highlight.conversationId)].map(
    ([id, group]): MarkdownGroup => ({
      title: titles.get(id) ?? conversationUrl(id),
      url: conversationUrl(id),
      highlights: group,
    }),
  )
}

const exportMarkdown = ({ doc, store }: Runtime, highlights: readonly Highlight[]): void => {
  const text = renderMarkdown(groupsOf(store.library.value?.snapshot, highlights))
  downloadFile(doc, { name: exportFileName('md', Date.now()), text, type: MARKDOWN_TYPE })
}

const exportBackup = async (runtime: Runtime): Promise<void> => {
  const result = await request({ type: 'backup.export' })
  if (!result.ok) return showFailure(runtime.store, result.error)
  const name = exportFileName('json', Date.now())
  downloadFile(runtime.doc, { name, text: result.data, type: JSON_MEDIA_TYPE })
}

const importBackup = async ({ store }: Runtime, file: File): Promise<void> => {
  const text = await file.text().catch(() => null)
  if (text === null) return showMessage(store, READ_FAILED_MESSAGE)
  const result = await request({ type: 'backup.import', text })
  if (result.ok) showMessage(store, importedMessage(result.data))
  else showFailure(store, result.error)
}

const purge = async ({ store }: Runtime, conversationId: string): Promise<void> => {
  const result = await request({ type: 'conversation.purge', conversationId })
  if (!result.ok) showFailure(store, result.error)
}

const copy = async ({ store }: Runtime, highlight: Highlight): Promise<void> => {
  try {
    await navigator.clipboard.writeText(highlightToMarkdown(highlight))
    showMessage(store, COPIED_MESSAGE)
  } catch {
    showMessage(store, COPY_FAILED_MESSAGE)
  }
}

const jumper =
  (
    { doc, store }: Runtime,
    host: Pick<LibraryHost, 'closeInPlace'>,
    reveal: Pick<Reveal, 'track'>,
  ) =>
  ({ conversationId, id }: Highlight): void => {
    const target: Jump = { conversationId, highlightId: id }
    saveJump(target)
    if (conversationId === store.conversationId.value) {
      host.closeInPlace()
      reveal.track(target)
      return
    }
    const link = conversationLink(doc, conversationId)
    if (!link) {
      doc.location.assign(conversationUrl(conversationId))
      return
    }
    link.click()
    reveal.track(target)
  }

export const createLibraryActions = (
  runtime: Runtime,
  host: Pick<LibraryHost, 'close' | 'closeInPlace'>,
  reveal: Pick<Reveal, 'track'>,
): LibraryActions => ({
  closeLibrary: host.close,
  jumpTo: jumper(runtime, host, reveal),
  copyMarkdown: (highlight) => void copy(runtime, highlight),
  exportMarkdown: (highlights) => exportMarkdown(runtime, highlights),
  exportBackup: () => void exportBackup(runtime),
  importBackup: (file) => void importBackup(runtime, file),
  purgeConversation: (conversationId) => void purge(runtime, conversationId),
})
