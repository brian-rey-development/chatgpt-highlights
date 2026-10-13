import { LIMITS } from './limits'

const LEADING_MARKS = /^[\s#]+/
const WHITESPACE_RUN = /\s+/g

export const normalizeTag = (raw: string): string | null => {
  const tag = raw.replace(LEADING_MARKS, '').trimEnd().toLowerCase().replace(WHITESPACE_RUN, '-')
  return tag === '' || tag.length > LIMITS.tagChars ? null : tag
}

export const tagLabel = (tag: string): string => `#${tag}`

export const addTag = (tags: readonly string[], raw: string): string[] => {
  const tag = normalizeTag(raw)
  if (tag === null || tags.includes(tag) || tags.length >= LIMITS.tags) return [...tags]
  return [...tags, tag]
}
