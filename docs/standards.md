# Code Standards

`pnpm check` fails on any mechanical rule. Review rejects the judgment rules. Every review finding is fixed, nitpicks included.

## Enforced by tooling

The standards script parses `src`, `e2e` and the root config and setup files (`wxt.config.ts`, `vitest.config.ts`, `vitest.setup.ts`), so the cast, class, import and banned-API rules reach them too. A root config may import any domain and the browser APIs, and needs no colocated test. The `video` folder is a separate project, so it stays out of the type check, Biome and the standards script.

| Rule | Limit | Enforced by |
|---|---|---|
| Function length | 20 lines, blank lines excluded | Biome |
| Cognitive complexity | 6 per function | Biome |
| Parameters | 3; pass an object beyond that | Biome |
| File length | 200 lines, blank lines excluded | Biome |
| Control flow | no nested ternaries, collapsed ifs, early returns, no `forEach` | Biome |
| Callbacks | at most 3 levels | Biome |
| Magic values | named constants only | Biome |
| Types | strict TS, `noUncheckedIndexedAccess`, no `any`, no `!`, `import type`; `video/` is excluded from `tsc` | tsc, Biome |
| Type assertions | only with a WHY comment on the line above | standards script |
| Functions | arrow function expressions; classes only in `src/errors/app-error.ts` | Biome, standards script |
| Exports | named only (WXT entrypoints and configs excepted), no enums, no namespaces | Biome |
| Dead code | no unused imports, variables or parameters | Biome, tsc |
| Leftovers | no `console`, `.only`, `.skip`, TODO, `@ts-ignore` | Biome, standards script |
| Banned APIs | raw HTML injection (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment`, `srcdoc`, `document.write`), `localStorage`, `setInterval` | standards script |
| Top-level folders | only the domains in `EDGES` in `scripts/standards/config.mjs`, `entrypoints`, `testing` | standards script |
| Folder names | never `lib`, `utils`, `helpers`, `shared`, `common`, `misc`, `core` | standards script |
| Nesting | at most three folders below `src` | standards script |
| File names | `.ts` kebab-case, `.tsx` PascalCase, tests `<name>.test.ts(x)` beside the file | standards script, Biome |
| Tests | every source file has a colocated test, except `index.ts`, `types.ts` and files in `src/testing`, where only helpers with logic of their own (branches or emulated browser behaviour) get a test | standards script |
| `types.ts` | type declarations only, no runtime exports | standards script |
| Domain surface | each domain has `index.ts`; other code, `e2e/` included, imports only `@/<domain>` | standards script |
| Domain edges | the `EDGES` table in `scripts/standards/config.mjs`; only tests import `@/testing`; no cycles | standards script, Biome |
| Relative imports | `./` and `../` only when the target stays inside the importer's domain, with `e2e/` counted as one; no `~`, `~~` or `@@` aliases | standards script |
| Browser APIs | `wxt`, `wxt/*`, `@wxt-dev/*`, `webextension-polyfill` only in `messaging` and `entrypoints` | standards script |
| Source language | `.ts` and `.tsx` only under `src` | standards script |
| Dynamic imports | string-literal specifiers only | standards script |
| Content bundle | no `schemas`, `backup`, `storage`, `zod`, `idb`; at most 28 KiB gzipped | standards script, `pnpm bundle` |
| Comments | one-line WHY only, at most one per 20 code lines, no block comments | standards script |
| Em dash | never, in any text file (images and fonts are skipped) | standards script |
| Formatting | 2 spaces, single quotes, no semicolons, width 100 | Biome |
| Coverage | 95% lines, statements, functions; 90% branches | Vitest |
| Lint output | zero errors, warnings and infos | Biome flags |

## Enforced by review

- Names are domain words (highlight, conversation, message, quote, anchor, orphan, pill, popover). No `data`, `info`, `item`, `handle`, `manager`, `util`, `helper` without a qualifier. Booleans read as questions.
- A function either orchestrates or computes. One level of abstraction per function.
- Data over control flow: lookup tables, `map`, `filter`, `flatMap`.
- Immutability: `toSorted`, spreads, `ReadonlyMap`. A local `let` only when clearly simpler.
- Errors: domains throw `AppFailure`; the router and UI turn it into `Result` and a toast. No silent `catch`.
- YAGNI: no option, parameter or export without a caller today. DRY: tests import production rules.
- Tests read as specifications, one behavior per `it`, no test that only asserts a mock was called.
- A new file looks like its siblings.

## Conventions

These are the shapes the codebase already uses. A new file follows them, and review treats a second way of doing the same thing as a finding.

- **One home per shared thing.** Product constants and pure helpers live in `model` (`HIGHLIGHT_COLORS`, `ACCENT_FALLBACKS`, `MINUTE_MS`/`HOUR_MS`/`DAY_MS`, `fieldOf`, `tagLabel`, `HIGHLIGHTER_ICON`). Every ChatGPT selector and attribute name lives in `chatgpt/selectors.ts`. Quote and Markdown formatting lives in `markdown` (`toBlockquote`). Validation lives in `schemas` (`timestampSchema`, `MAX_DATE_MS`, `describeIssues`). Before writing a helper, search for it; when two domains need one, it goes in the lowest domain both may import, or the orchestrator rules on a new edge.
- **Constant names.** Durations end in `_MS`, pixel sizes in `_PX`, attribute names in `_ATTR`. Selectors that share an attribute are built from its `_ATTR` constant.
- **Unknown values.** Fields of `unknown` values are read only through `fieldOf`.
- **Test support.** Everything shared by tests lives in `src/testing` and is imported from `@/testing`: factories (`makeQuote`, `makeHighlight`, `makeConversation`), `FIXED_TIME` as the one test clock, HTML fixtures with `mountFixture`, DOM helpers (`requireElement`, `requireText`, `rangeOver`), and jsdom gap fakes named `installFake*`. A test never re-declares a production constant, selector or time; it imports it. Only `chatgpt/selectors.test.ts` writes selector literals, to pin them. E2E specs run in Node without Vite or vitest, so they import `@/<domain>` surfaces and only the vitest-free modules `@/testing/factories` and `@/testing/fixture-ids` from test support.
- **Test shape.** Table tests use `it.each` with object rows and `$name` titles. Global cleanup (mocks, stubbed globals, fake timers, `fakeBrowser`) lives in `vitest.config.ts` and `vitest.setup.ts`, never in a test file.
- **Domain surface.** `index.ts` uses `export *` when every export of the domain is public, and names its exports when the domain has internal ones.
- **Keyboard.** Everything the pill offers works without a pointer. A selection made with the keyboard is offered after `selectionchange` on the next frame, never while a pointer is held, Tab moves into the pill, and Escape dismisses it.
- **Browsers in e2e.** `pnpm e2e` runs Chromium only. `pnpm e2e:firefox` loads `dist/firefox-mv3` into a real Firefox through Marionette and stays out of the default run; see `docs/firefox-testing.md`.
- **Stylesheets.** Each component's `.css` sits beside it and no module imports a stylesheet; `ui/styles.ts` bundles `theme.css`, then `base.css`, then every component sheet into `OVERLAY_STYLES`, which the overlay mounts; shared primitives live in `base.css`. Class names are `hl-<block>`, `hl-<block>__<element>`, `hl-<block>--<modifier>`. Colors, text sizes, radii and stacking order come only from `--hl-*` tokens; spacing stays literal.
