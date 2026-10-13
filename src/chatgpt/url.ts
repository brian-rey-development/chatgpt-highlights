export const CHATGPT_ORIGIN = 'https://chatgpt.com'
export const CHATGPT_MATCH = 'https://chatgpt.com/*'
export const LIBRARY_HASH = '#highlights'
export const LIBRARY_ADDRESS = `/${LIBRARY_HASH}`
export const LIBRARY_URL = `${CHATGPT_ORIGIN}${LIBRARY_ADDRESS}`

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const CONVERSATION_PATH = new RegExp(`^(?:/(?:g|project)/[^/]+)?/c/(${UUID})/?$`, 'i')
const ID_GROUP = 1

export const conversationIdFromPath = (pathname: string): string | null =>
  CONVERSATION_PATH.exec(pathname)?.[ID_GROUP]?.toLowerCase() ?? null

export const conversationUrl = (conversationId: string): string =>
  `${CHATGPT_ORIGIN}/c/${conversationId}`

export const TEMPORARY_CHAT_PARAM = 'temporary-chat'
const TEMPORARY_CHAT_ON = 'true'

export const isTemporaryChat = (search: string): boolean =>
  new URLSearchParams(search).get(TEMPORARY_CHAT_PARAM) === TEMPORARY_CHAT_ON
