export interface RetryQueue {
  readonly attempts: Map<Element, number>
  timer: ReturnType<typeof setTimeout> | null
}

const FIRST_RETRY_MS = 250
const SECOND_RETRY_MS = 1000
const LAST_RETRY_MS = 4000

// ChatGPT renders some messages in stages, and a stage can end without any node or text change
export const RETRY_DELAYS_MS = [FIRST_RETRY_MS, SECOND_RETRY_MS, LAST_RETRY_MS] as const

const hasTriesLeft = (used: number): boolean => used < RETRY_DELAYS_MS.length

export const createRetryQueue = (): RetryQueue => ({ attempts: new Map(), timer: null })

export const recordMisses = (
  { attempts }: RetryQueue,
  ready: readonly Element[],
  missed: readonly Element[],
): void => {
  for (const element of ready) {
    if (!missed.includes(element)) attempts.delete(element)
    else if (!attempts.has(element)) attempts.set(element, 0)
  }
}

export const forgetRetry = ({ attempts }: RetryQueue, element: Element): void => {
  attempts.delete(element)
}

export const clearRetries = (queue: RetryQueue): void => {
  queue.attempts.clear()
  if (queue.timer !== null) clearTimeout(queue.timer)
  queue.timer = null
}

const takeDue = ({ attempts }: RetryQueue): Element[] => {
  const due: Element[] = []
  for (const [element, used] of attempts) {
    if (!element.isConnected || !hasTriesLeft(used)) attempts.delete(element)
    else attempts.set(element, used + 1)
    if (attempts.has(element)) due.push(element)
  }
  return due
}

export const scheduleRetry = (queue: RetryQueue, onDue: (due: Element[]) => void): void => {
  const { attempts } = queue
  for (const [element, used] of attempts) {
    if (!hasTriesLeft(used)) attempts.delete(element)
  }
  if (queue.timer !== null || attempts.size === 0) return
  const delay = RETRY_DELAYS_MS[Math.min(...attempts.values())] ?? 0
  queue.timer = setTimeout(() => {
    queue.timer = null
    onDue(takeDue(queue))
  }, delay)
}
