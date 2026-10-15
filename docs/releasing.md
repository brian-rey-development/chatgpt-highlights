# Releasing

One command builds the packages, checks them and sends them to the Chrome Web Store and to addons.mozilla.org. The store review that follows is still done by a person at each store, so a submission is not a publication.

## One-time setup

Run `pnpm exec wxt submit init`. It asks for the credentials of each store and writes them to `.env.submit`, which is ignored by git. You can also write that file by hand with these variables, `CHROME_API_VERSION` set to `v2`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`, `FIREFOX_EXTENSION_ID` set to `chatgpt-highlights@brian-rey-development`, `FIREFOX_JWT_ISSUER` and `FIREFOX_JWT_SECRET`.

For Chrome the project uses version 2 of the Chrome Web Store API, which authorizes with a Google Cloud service account. You need the extension id and the publisher id from the Chrome Web Store Developer Dashboard, and the client email and private key of a service account that the dashboard account has allowed to publish. For Firefox you need the JWT issuer and secret of an API key from Developer Hub, under Manage API Keys. The full list of options is in the publish-browser-extension configuration reference.

Never commit `.env.submit`. If a secret ever lands in a chat, a log or a commit, revoke the key at its store and create a new one.

## Each release

1. Raise `version` in `package.json` above the version that is live in each store. Both stores reject a version number they already hold, and AMO shares one number space between its listed and unlisted channels.
2. Run `pnpm submit:dry`. It runs the zip step and checks the credentials of every store without uploading anything.
3. Run `pnpm submit`. It runs `pnpm check`, builds the three packages with `pnpm zip` and uploads the Chrome package, the Firefox package and the Firefox sources zip that AMO reviewers need.
4. Follow the review in each dashboard. `pnpm exec wxt submit status` prints what each store currently holds.

## Using a build before the review ends

Chrome loads `dist/chrome-mv3` unpacked, and reloading it from `chrome://extensions` picks up a new build.

Firefox release builds only run signed add-ons. AMO signs an unlisted upload automatically in a few minutes, and the signed file installs permanently from `about:addons` through Install Add-on From File. Build, raise `version` in `dist/firefox-mv3/manifest.json` to a number no store holds yet, for example `0.1.2.4`, and run `pnpm exec web-ext sign --channel unlisted --source-dir dist/firefox-mv3 --artifacts-dir dist/signed` with `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` set to the same Firefox credentials. Only the compiled manifest changes, so `package.json` and git stay as they are. A store version with the same add-on id replaces the local one once it is approved.
