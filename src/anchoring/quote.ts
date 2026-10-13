import { LIMITS, type Quote, type Span } from '@/model'

interface Candidate {
  span: Span
  score: number
  distance: number
}

export const describeQuote = (text: string, span: Span): Quote => ({
  exact: text.slice(span.start, span.end),
  prefix: text.slice(Math.max(0, span.start - LIMITS.contextChars), span.start),
  suffix: text.slice(span.end, span.end + LIMITS.contextChars),
  start: span.start,
  end: span.end,
})

const leadingMatch = (left: string, right: string): number => {
  let count = 0
  while (count < left.length && left[count] === right[count]) count += 1
  return count
}

const trailingMatch = (left: string, right: string): number => {
  let count = 0
  while (count < left.length && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1
  }
  return count
}

const occurrenceStarts = (text: string, exact: string): number[] => {
  const starts: number[] = []
  for (let at = text.indexOf(exact); at !== -1; at = text.indexOf(exact, at + 1)) {
    starts.push(at)
  }
  return starts
}

const candidateAt = (text: string, quote: Quote, start: number): Candidate => {
  const end = start + quote.exact.length
  const before = text.slice(Math.max(0, start - LIMITS.contextChars), start)
  const after = text.slice(end, end + LIMITS.contextChars)
  return {
    span: { start, end },
    score: trailingMatch(quote.prefix, before) + leadingMatch(quote.suffix, after),
    distance: Math.abs(start - quote.start),
  }
}

const isBetter = (candidate: Candidate, best: Candidate): boolean =>
  candidate.score > best.score ||
  (candidate.score === best.score && candidate.distance < best.distance)

export const locateQuote = (text: string, quote: Quote): Span | null => {
  if (quote.exact === '') return null
  if (text.slice(quote.start, quote.end) === quote.exact) {
    return { start: quote.start, end: quote.end }
  }
  const candidates = occurrenceStarts(text, quote.exact).map((start) =>
    candidateAt(text, quote, start),
  )
  const best = candidates.reduce<Candidate | null>(
    (leader, candidate) => (leader && !isBetter(candidate, leader) ? leader : candidate),
    null,
  )
  return best?.span ?? null
}
