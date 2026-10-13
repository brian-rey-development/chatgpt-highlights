import type { Conversation, Highlight, ImportReport, Snapshot } from '@/model'

export interface ImportPlan {
  conversations: Conversation[]
  highlights: Highlight[]
  report: ImportReport
}

interface Versioned {
  id: string
  updatedAt: number
}

type Verdict = keyof ImportReport

const verdictOf = (current: Versioned | undefined, candidate: Versioned): Verdict => {
  if (current === undefined) return 'added'
  return candidate.updatedAt > current.updatedAt ? 'updated' : 'skipped'
}

const merge = <T extends Versioned>(existing: readonly T[], incoming: readonly T[]) => {
  const byId = new Map(existing.map((entity) => [entity.id, entity]))
  const judged = incoming.map((entity) => ({
    entity,
    verdict: verdictOf(byId.get(entity.id), entity),
  }))
  const count = (verdict: Verdict): number => judged.filter((row) => row.verdict === verdict).length
  return {
    changed: judged.filter((row) => row.verdict !== 'skipped').map((row) => row.entity),
    report: { added: count('added'), updated: count('updated'), skipped: count('skipped') },
  }
}

const isMovedBy = (existing: readonly Highlight[]) => {
  const owners = new Map(existing.map(({ id, conversationId }) => [id, conversationId]))
  return ({ id, conversationId }: Highlight): boolean => {
    const owner = owners.get(id)
    return owner !== undefined && owner !== conversationId
  }
}

export const planImport = (existing: Snapshot, incoming: Snapshot): ImportPlan => {
  const isMoved = isMovedBy(existing.highlights)
  const highlights = merge(
    existing.highlights,
    incoming.highlights.filter((highlight) => !isMoved(highlight)),
  )
  const populated = new Set([
    ...existing.conversations.map(({ id }) => id),
    ...highlights.changed.map(({ conversationId }) => conversationId),
  ])
  const conversations = merge(existing.conversations, incoming.conversations).changed
  return {
    conversations: conversations.filter(({ id }) => populated.has(id)),
    highlights: highlights.changed,
    report: {
      ...highlights.report,
      skipped: highlights.report.skipped + incoming.highlights.filter(isMoved).length,
    },
  }
}
