# Chrome Web Store listing, 0.1.2

Package `dist/chatgpt-highlights-0.1.2-chrome.zip`. Images in this folder.

## Store listing

- Category: Productivity / Tools
- Language: English
- Summary comes from the manifest description.
- Description:

```
Select any passage in a ChatGPT answer and paint it in one of five colors. Add a note and tags, then find everything again in a Highlights view that opens inside ChatGPT, with search, color and tag filters, and a jump back to the exact passage.

Highlights survive reloads, navigation and ChatGPT re-rendering a message, and they never change the page's markup.

Everything stays in your browser, in the extension's own database. There is no server, no account and no telemetry. Highlighting is off in ChatGPT's temporary chats. Export to Markdown or back up and restore as JSON whenever you like.

Open source under the MIT license.
```

- Store icon: `public/icons/128.png`
- Screenshots: `screenshot-highlights-view.png`, `screenshot-pill.png`, `screenshot-popover.png` (1280x800)
- Small promo tile: `promo-small-440x280.png`
- Marquee promo tile: `promo-marquee-1400x560.png`
- Homepage: https://github.com/brian-rey-development/chatgpt-highlights
- Support: https://github.com/brian-rey-development/chatgpt-highlights/issues

## Privacy practices

Single purpose:

```
Lets the user highlight, annotate and revisit passages of their own ChatGPT conversations on chatgpt.com, storing everything locally in the browser.
```

Host permission (https://chatgpt.com/*):

```
The content script runs only on chatgpt.com to draw highlights over ChatGPT answers, show the highlight controls and open the Highlights view inside the page. It also makes same-origin requests to chatgpt.com to check whether a saved conversation still exists, at most once an hour per conversation.
```

unlimitedStorage:

```
Highlights, notes and tags are stored only in the extension's local IndexedDB database. Long-time users can collect many highlights, so the default quota could be exceeded and data would be lost.
```

alarms:

```
A daily alarm permanently removes highlights that have been in Recently deleted for more than 30 days, so the local database does not keep growing with data the user no longer sees.
```

Remote code: No, all code ships in the package.

Data usage: no box ticked. Nothing is sent to the developer or any third party. The only requests go to chatgpt.com with the user's own ChatGPT session.

Certify the three Limited Use statements.

Privacy policy URL: https://github.com/brian-rey-development/chatgpt-highlights#privacy
