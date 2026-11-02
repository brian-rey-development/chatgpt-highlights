# Contributing

Thanks for helping with Highlights for ChatGPT. Every change reaches `main` through a pull request, because direct pushes to `main` are blocked.

## Report a bug or ask for a feature

Open an issue with the bug report or feature request form. Search the existing issues first, so the same problem is not reported twice. Report a security problem privately as `SECURITY.md` explains, never in a public issue.

## Make a change

1. Fork the repository and create a branch from `main`.
2. Install the dependencies with `pnpm install` and start the extension with `pnpm dev` or `pnpm dev:firefox`. The README lists the supported Node versions.
3. Follow the rules in `docs/standards.md`. Add or update the colocated test for every source file you change.
4. Run `pnpm check` before you push. Run `pnpm bundle` too when you change the content script.
5. Use a conventional commit title, for example `fix: keep highlight after reload`.
6. Open a pull request against `main` and fill in the template. Link the issue the change closes.

A pull request merges when every review thread is resolved. Keep one change per pull request, because a small diff is faster to review.
