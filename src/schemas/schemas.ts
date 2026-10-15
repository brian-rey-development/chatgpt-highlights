import { z } from 'zod'
import { err, ok, type Result } from '@/errors'
import type { Request } from '@/messaging'
import type { Conversation, Highlight } from '@/model'
import { HIGHLIGHT_COLORS, LIMITS, normalizeTag } from '@/model'

// The extension CSP forbids eval, which zod's JIT uses
z.config({ jitless: true })

export const MAX_DATE_MS = 8_640_000_000_000_000

const idSchema = z.string().min(1).max(LIMITS.idChars)
const titleSchema = z.string().max(LIMITS.titleChars)
export const timestampSchema = z.number().int().nonnegative().max(MAX_DATE_MS)
const offsetSchema = z.number().int().nonnegative().max(LIMITS.messageChars)
const colorSchema = z.enum(HIGHLIGHT_COLORS)
const noteSchema = z.string().max(LIMITS.noteChars)
const isNormalizedTag = (tag: string): boolean => normalizeTag(tag) === tag

const tagsSchema = z
  .array(z.string().refine(isNormalizedTag, { message: 'tag is not normalized' }))
  .max(LIMITS.tags)
  .refine((tags) => new Set(tags).size === tags.length, { message: 'tags repeat' })

const quoteSchema = z
  .strictObject({
    exact: z.string().min(1).max(LIMITS.quoteChars),
    prefix: z.string().max(LIMITS.contextChars),
    suffix: z.string().max(LIMITS.contextChars),
    start: offsetSchema,
    end: offsetSchema,
  })
  .refine((quote) => quote.end - quote.start === quote.exact.length, {
    message: 'quote offsets do not span the exact text',
  })

export const highlightSchema: z.ZodType<Highlight> = z.strictObject({
  id: idSchema,
  conversationId: idSchema,
  messageId: idSchema,
  quote: quoteSchema,
  color: colorSchema,
  note: noteSchema,
  tags: tagsSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const hasTrashTimeExactlyWhenTrashed = ({ status, trashedAt }: Conversation): boolean =>
  (status === 'trashed') === (trashedAt !== null)

export const conversationSchema: z.ZodType<Conversation> = z
  .strictObject({
    id: idSchema,
    title: titleSchema,
    status: z.enum(['active', 'trashed']),
    trashedAt: timestampSchema.nullable(),
    checkedAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine(hasTrashTimeExactlyWhenTrashed, {
    message: 'trashedAt must be set exactly when the chat is trashed',
  })

const newHighlightSchema = z.strictObject({
  conversationId: idSchema,
  conversationTitle: titleSchema,
  messageId: idSchema,
  quote: quoteSchema,
  color: colorSchema,
  note: noteSchema,
})

const patchSchema = z
  .strictObject({
    color: colorSchema.optional(),
    note: noteSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'patch changes nothing',
  })

const outcomeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('exists'), title: titleSchema }),
  z.strictObject({ kind: z.literal('missing') }),
  z.strictObject({ kind: z.literal('unknown') }),
])

const deletedSchema = z
  .strictObject({
    highlight: highlightSchema,
    conversation: conversationSchema,
  })
  .refine(({ highlight, conversation }) => highlight.conversationId === conversation.id, {
    message: 'highlight belongs to another chat',
  })

const bare = <T extends Request['type']>(type: T) => z.strictObject({ type: z.literal(type) })

const forConversation = <T extends Request['type']>(type: T) =>
  z.strictObject({ type: z.literal(type), conversationId: idSchema })

export const requestSchema: z.ZodType<Request> = z.discriminatedUnion('type', [
  forConversation('conversation.load'),
  forConversation('conversation.purge'),
  bare('conversations.list'),
  bare('library.snapshot'),
  bare('backup.export'),
  z.strictObject({
    type: z.literal('conversation.check'),
    conversationId: idSchema,
    outcome: outcomeSchema,
  }),
  z.strictObject({ type: z.literal('highlight.create'), input: newHighlightSchema }),
  z.strictObject({ type: z.literal('highlight.update'), id: idSchema, patch: patchSchema }),
  z.strictObject({ type: z.literal('highlight.delete'), id: idSchema }),
  z.strictObject({ type: z.literal('highlight.restore'), deleted: deletedSchema }),
  z.strictObject({ type: z.literal('backup.import'), text: z.string() }),
])

export const describeIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.')
      return path === '' ? issue.message : `${path}: ${issue.message}`
    })
    .join('; ')

export const parseRequest = (message: unknown): Result<Request> => {
  const parsed = requestSchema.safeParse(message)
  if (parsed.success) return ok(parsed.data)
  return err({ code: 'invalid_message', message: describeIssues(parsed.error) })
}
