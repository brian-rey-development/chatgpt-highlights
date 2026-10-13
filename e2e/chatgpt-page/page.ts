import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type Theme = 'light' | 'dark'

export const NATIVE_QUOTE_ATTR = 'data-fixture-native-quote'
export const SCROLL_RESTORE_DELAY_MS = 1_000
export const FIXTURE_FONT = 'Fixture Sans'
export const TEXT_COLORS: Readonly<Record<Theme, string>> = {
  light: 'rgb(13, 13, 13)',
  dark: 'rgb(237, 237, 237)',
}

const FIXTURE_DIR = resolve(import.meta.dirname, '../../src/testing/fixtures')
const readFixture = (name: string): string => readFileSync(resolve(FIXTURE_DIR, name), 'utf8')

export const conversationHtml = readFixture('conversation.html')
export const sessionJson = readFixture('session.json')
const askBoxHtml = readFixture('ask-box.html')
const sidebarHtml = readFixture('sidebar.html')

const TOKENS: Readonly<Record<Theme, string>> = {
  light: `
    --color-surface: #fcfcfc;
    --color-surface-elevated-secondary: #ffffff;
    --color-text-secondary: #5d5d5d;
    --color-text-tertiary: #8f8f8f;
    --color-text-inverse: #ffffff;
    --color-text-danger: #e02e2a;
    --color-border: #0000001a;
    --color-border-subtle: #0000000d;
    --color-border-strong: #00000026;
    --color-background-primary-soft-hover: #0000000d;
    --composer-background-color: #ffffff;
    --shadow-hairline-color: #0000001a;
    --selection: rgba(238, 124, 55, 0.3);`,
  dark: `
    --color-surface: #000000;
    --color-surface-elevated-secondary: #303030;
    --color-text-secondary: #cdcdcd;
    --color-text-tertiary: #afafaf;
    --color-text-inverse: #0d0d0d;
    --color-text-danger: #ff6764;
    --color-border: #ffffff26;
    --color-border-subtle: #ffffff0d;
    --color-border-strong: #ffffff33;
    --color-background-primary-soft-hover: #ffffff1a;
    --composer-background-color: #1b1b1b;
    --shadow-hairline-color: #ffffff1f;
    --selection: rgba(238, 124, 55, 0.6);`,
}

const pageCss = (theme: Theme): string => `
  :root {${TOKENS[theme]}
    color-scheme: ${theme};
    --color-text: ${TEXT_COLORS[theme]};
    --font-ui-family: "${FIXTURE_FONT}", ui-sans-serif, system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--color-surface); color: var(--color-text);
    font: 14px/1.6 var(--font-ui-family); }
  ::selection { background: var(--selection); }
  .layout { display: flex; height: 100vh; }
  .rail { width: 260px; flex: none; border-right: 1px solid var(--color-border);
    padding: 12px 8px; }
  .rail nav { display: flex; flex-direction: column; gap: 2px; }
  .rail button, .rail a { display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 6px 10px; border-radius: 10px; color: inherit; text-decoration: none;
    background: none; border: 0; font: inherit; cursor: pointer; }
  .rail button:hover, .rail a:hover { background: var(--color-background-primary-soft-hover); }
  .rail svg { width: 18px; height: 18px; flex: none; }
  main { flex: 1; min-width: 0; overflow: auto; display: flex; flex-direction: column; }
  main > div { flex: 1; }
  article { max-width: 720px; margin: 0 auto; padding: 8px 24px; }
  article:empty { display: none; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  form { position: sticky; bottom: 0; margin: 0 auto; width: 100%; max-width: 720px;
    padding: 12px 24px 20px; background: var(--color-surface); }
  .ProseMirror { min-height: 48px; padding: 12px 16px; border-radius: 28px;
    background: var(--composer-background-color); border: 1px solid var(--color-border); }
  .ProseMirror p { margin: 0; }
  [${NATIVE_QUOTE_ATTR}] { margin-bottom: 8px; padding: 6px 12px;
    border-left: 3px solid var(--color-border-strong); color: var(--color-text-secondary); }
  .fixed { position: fixed; z-index: 30; }
  .fixed button { padding: 6px 12px; border-radius: 10px; border: 1px solid var(--color-border);
    background: var(--color-surface-elevated-secondary); color: inherit; }
  pre, code { font-family: ui-monospace, monospace; }
`

interface PageOptions {
  theme: Theme
  title: string
  thread: string
}

export const renderPage = ({ theme, title, thread }: PageOptions): string => `<!doctype html>
<html lang="en" data-theme="${theme}" class="chatgpt-theme">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${pageCss(theme)}</style>
</head>
<body>
<div class="layout">
<aside class="rail">${sidebarHtml}</aside>
${thread}
</div>
${askBoxHtml}
</body>
</html>`
