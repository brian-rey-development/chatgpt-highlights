# chatgpt.com recon, 2026-10-12

Observed on a logged-in Free account, Chrome, dark theme, build `314720d0`. Only structure, attributes and status codes were read.

## Messages

| Concept | Selector | Notes |
|---|---|---|
| Assistant message unit | `[data-chatgpt-selection-message-id]` | Also carries `data-chatgpt-selection-conversation-id`. Only assistant messages have it. |
| Assistant text root | `[data-markdown-text-style]` inside the unit | Also carries `data-selected-text-overlay-target`, ChatGPT's own selection layer. |
| User message | `[data-user-message-bubble]` | Not inside a selection unit. Out of scope for v1. |
| Turn | `[data-turn-key]` | Contains `[data-chatgpt-search-message-ids]` listing its message ids, and `h4[data-conversation-role]`. |
| Code block | `[data-markdown-copy="code-block"]` | Not a `pre` any more. A `div` holding a header `[data-markdown-copy="exclude"]` (`select-none`, so `user-select: none`, with an icon, the language label and Copy buttons) and a `div[dir="ltr"]` holding one `code`. Observed 2026-10-12 on the same build. |
| Copy exclusion | `[data-markdown-copy="exclude"]` | ChatGPT's own marker for text left out of copies. Inside a text root it is the code header; other matches sit outside text roots. Inline code carries `data-markdown-copy="inline-code"`. |
| Virtualization | none observed | Turns had `content-visibility: visible` and no `[data-virtualized-turn-content]` on a short chat. A CSS rule for that attribute exists, so long chats may virtualize. Keep `scrollToMessage`. |

## Main pane

A fresh load renders one `<main>`. After an in-app navigation from a conversation to New chat (checked 2026-10-13), ChatGPT keeps the conversation's `<main>` mounted but hidden at 0 by 0 and mounts a second, visible `<main>` for the new page, each under the same `.MainContentClip` wrapper and each with its own composer `<form>`. Back removes the second one again. So every lookup of the main pane, the thread, a message unit or the composer has to pick the visible `<main>`, never the first match in the document.

The thread scrolls inside `main .thread-scroll-container` while the root scroller stays at 0, so the browser's own scroll restoration never moves it. After a Back, ChatGPT restores the thread scroll with its own code (`restoreScrollDistanceFromBottomPx` in its bundle), at a time that varied from run to run and was seen about a second after popstate. A jump to a highlight in the chat under the view therefore closes the view with `replaceState` instead of traversing, because a traversal would let that late restore scroll the highlight away again.

## Sidebar

| Concept | Selector | Notes |
|---|---|---|
| Expanded sidebar | `nav[aria-label="Chat history"]` | Label is localized; do not depend on it. |
| Collapsed rail | `nav[data-app-navigation-rail]` | Has its own hidden copies of destination buttons. |
| Library item | `button[data-sidebar-destination="builtin:library"]` | A `button`, not a link. Two exist (rail and expanded); use the visible one. Other destinations: `builtin:images`, `builtin:automations`, `builtin:skills`. The set varies by account and load. |
| Active item | `[aria-current="page"]` | Active destination also gets class `bg-primary-ghost-hover`. History links are `a[data-interactive-row-link][href="/c/<id>"]`. |

## Composer and native Ask

| Concept | Selector | Notes |
|---|---|---|
| Composer | `form .ProseMirror[contenteditable="true"][role="textbox"]` | No `#prompt-textarea` id any more. Carries `data-composer-markdown`. |
| Stop button | `form button[data-testid="stop-button"]`, `form button[aria-label^="Stop"]` | Not observed (no generation was started). Unverified. |
| Native Ask box | `body div.fixed [role="presentation"]` containing one `button` | No stable attributes. Appears about 6 px above the selection's first line, left aligned, 30 px tall, 8 px radius. It stays in the DOM after the selection clears, so it must be matched by geometry near the current selection and by visibility. A programmatic selection did not reliably show it; treat `pasted` as a normal outcome. |

## Session and conversation status

| Request | Result |
|---|---|
| `GET /api/auth/session` | 200 with `accessToken` (string), `account.id`, `user.*`, `sessionToken` and more. Read `accessToken` only. |
| `GET /backend-api/conversation/<owned id>` with Bearer | 200, about 32 KB for a short chat, keys include `title`, `is_archived`. |
| Same, unknown id | 404 |
| Same, malformed id | 400 |
| Same, invalid token | 401 |
| Same, no Authorization header | **404**. A missing token looks exactly like a deleted chat, so never check without a token. |
| `HEAD` on the same URL | 405, so the full GET is the cheapest check. |

## Theme

`<html data-theme="light|dark" class="chatgpt-theme">`. Tokens as mapped in `src/ui/theme.css`. User accent changes `--color-background-user-message` and the selection color.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--color-text-danger` | `#e02e2a` | `#ff6764` | Destructive actions. |
| `--color-text-inverse` | `#ffffff` | `#0d0d0d` | Text on `--color-text-primary` fills (toast, active chip). |
| `--shadow-hairline-color` | `#0000001a` | `#ffffff1f` | Build the ring as `0 0 0 0.5px var(--shadow-hairline-color)`; the composed `--shadow-hairline` keeps its light value in dark. |
| `--shadow-lg` | `0px 4px 8px -2px #0000001a` | same | |

## Not verifiable here

Content-script `fetch` cookie behavior in Chrome and Firefox is verified by the E2E fixture and the manual Firefox checklist.
