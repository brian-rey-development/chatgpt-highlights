export const MAIN = 'main'
export const TURN_KEY_ATTR = 'data-turn-key'
export const TURN = `[${TURN_KEY_ATTR}]`
export const TURN_MESSAGE_IDS_ATTR = 'data-chatgpt-search-message-ids'
export const MESSAGE_ID_ATTR = 'data-chatgpt-selection-message-id'
export const MESSAGE_UNIT = `[${MESSAGE_ID_ATTR}]`
export const TEXT_ROOT = '[data-markdown-text-style]'
export const COMPOSER_FORM = 'form'
export const TEST_ID_ATTR = 'data-testid'
export const LABEL_ATTR = 'aria-label'
export const GENERATION_ATTRS = [TEST_ID_ATTR, LABEL_ATTR] as const
export const ARIA_HIDDEN_ATTR = 'aria-hidden'
export const HIDDEN_ATTR = 'hidden'
export const READABILITY_ATTRS = [ARIA_HIDDEN_ATTR, HIDDEN_ATTR] as const
export const STOP_BUTTON_TEST_ID = 'stop-button'
export const STOP_BUTTON = [
  `button[${TEST_ID_ATTR}="${STOP_BUTTON_TEST_ID}"]`,
  `button[${LABEL_ATTR}^="Stop"]`,
].join(', ')
export const COMPOSER = `${COMPOSER_FORM} .ProseMirror[contenteditable="true"][role="textbox"]`
export const ASK_BOX = 'body div.fixed [role="presentation"]'
export const DESTINATION_ATTR = 'data-sidebar-destination'
export const ACTIVE_ATTR = 'aria-current'
export const SIDEBAR_DESTINATION = `button[${DESTINATION_ATTR}]`
export const LIBRARY_DESTINATION = `button[${DESTINATION_ATTR}="builtin:library"]`
export const NAV_ACTIVE = `nav [${ACTIVE_ATTR}="page"]`
export const NAV_ACTIVE_CLASS = 'bg-primary-ghost-hover'
export const HISTORY_LINK = 'a[data-interactive-row-link][href*="/c/"]'
export const SIDEBAR_LINK = [HISTORY_LINK, SIDEBAR_DESTINATION].join(', ')
export const NAV_ATTR = 'data-hl-nav'
export const OPEN_ATTR = 'data-hl-open'
export const INERT_ATTR = 'inert'
export const PAGE_STYLE_ID = 'hl-page-styles'
export const MARKDOWN_COPY_ATTR = 'data-markdown-copy'
export const CODE_BLOCK = `[${MARKDOWN_COPY_ATTR}="code-block"]`
export const COPY_EXCLUDED = `[${MARKDOWN_COPY_ATTR}="exclude"]`
export const IGNORED_TEXT_SELECTOR = [
  'button',
  'svg',
  `[${ARIA_HIDDEN_ATTR}="true"]:not(.katex-html)`,
  '.katex-mathml',
  COPY_EXCLUDED,
  'script',
  'style',
].join(', ')
