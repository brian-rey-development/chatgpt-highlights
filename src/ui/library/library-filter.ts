import type { Conversation, Highlight, Snapshot } from '@/model'
import type { LibraryFilter } from '../types'

export interface LibraryGroup {
  conversation: Conversation
  highlights: Highlight[]
}

interface LibrarySections {
  active: LibraryGroup[]
  trashed: LibraryGroup[]
}

interface GroupInput {
  conversation: Conversation
  highlights: readonly Highlight[]
  filter: LibraryFilter
  text: string
}

const byCreatedAt = (a: Highlight, b: Highlight): number => a.createdAt - b.createdAt

const newestOf = (group: LibraryGroup): number =>
  group.highlights.reduce((latest, highlight) => Math.max(latest, highlight.createdAt), 0)

const matchesText = (highlight: Highlight, title: string, text: string): boolean =>
  text === '' ||
  title.includes(text) ||
  [highlight.quote.exact, highlight.note].some((field) => field.toLowerCase().includes(text))

const matchesFacets = (highlight: Highlight, filter: LibraryFilter): boolean =>
  (filter.color === null || highlight.color === filter.color) &&
  (filter.tag === null || highlight.tags.includes(filter.tag))

const groupOf = ({ conversation, highlights, filter, text }: GroupInput): LibraryGroup => {
  const title = conversation.title.toLowerCase()
  return {
    conversation,
    highlights: highlights
      .filter(
        (highlight) => matchesFacets(highlight, filter) && matchesText(highlight, title, text),
      )
      .toSorted(byCreatedAt),
  }
}

export const groupLibrary = (snapshot: Snapshot, filter: LibraryFilter): LibrarySections => {
  const byConversation = Map.groupBy(snapshot.highlights, (highlight) => highlight.conversationId)
  const text = filter.text.trim().toLowerCase()
  const groups = snapshot.conversations
    .map((conversation) =>
      groupOf({
        conversation,
        highlights: byConversation.get(conversation.id) ?? [],
        filter,
        text,
      }),
    )
    .filter((group) => group.highlights.length > 0)
    .toSorted((a, b) => newestOf(b) - newestOf(a))
  return {
    active: groups.filter((group) => group.conversation.status === 'active'),
    trashed: groups.filter((group) => group.conversation.status === 'trashed'),
  }
}

export const tagsInUse = (snapshot: Snapshot): string[] =>
  [...new Set(snapshot.highlights.flatMap((highlight) => highlight.tags))].toSorted()

export const countRows = (groups: readonly LibraryGroup[]): number =>
  groups.reduce((sum, group) => sum + group.highlights.length, 0)

export const takeRows = (groups: readonly LibraryGroup[], limit: number): LibraryGroup[] => {
  let left = limit
  return groups.flatMap((group) => {
    const highlights = group.highlights.slice(0, left)
    left -= highlights.length
    return highlights.length === 0 ? [] : [{ ...group, highlights }]
  })
}
