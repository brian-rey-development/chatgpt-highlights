import { CHATGPT_MATCH } from '@/chatgpt'
import { broadcast } from '@/messaging'

export const announceChange = async (conversationIds: readonly string[]): Promise<void> => {
  if (conversationIds.length === 0) return
  await broadcast({ type: 'data.changed', conversationIds }, CHATGPT_MATCH)
}
