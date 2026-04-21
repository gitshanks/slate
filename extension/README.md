# Slate browser extension

Chrome Manifest V3 extension that reads your watch history from
Netflix, Prime Video, Hulu, and Disney+ and pushes it to a
[Slate](../) watchlist instance.

## Why an extension?

None of the big streaming services expose a public "my watch history"
API. The extension runs inside your already-signed-in browser tab and
reads the history DOM directly — same mechanism Trakt's scrobblers use.

## Build

```bash
cd extension
npm install
npm run build
```

Output goes to `extension/dist/`.

## Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and choose `extension/dist/`.
4. Click the Slate icon in your toolbar. Paste your Slate URL
   (e.g. `https://slate.mydomain.com`) and the token from
   `/settings` on that instance.

## Use

1. Visit a supported history page:
   - Netflix: <https://www.netflix.com/viewingactivity>
   - Prime Video: <https://www.amazon.com/gp/video/library>
   - Hulu: <https://www.hulu.com/account/watch-history>
   - Disney+: <https://www.disneyplus.com/watchlist>
2. Open the Slate popup → **Sync now**.
3. The popup logs `{service}: N saved — M unmatched`.

## Layout

```
extension/
  manifest.json         Chrome MV3 manifest
  popup.html            Popup DOM (inline styles, no framework)
  src/
    popup.ts            Popup behaviour
    background.ts       Service worker: POSTs to Slate
    shared.ts           Types + storage keys shared with popup/background
  content/
    shared.ts           DOM helpers (auto-scroll, waitFor, ISO date)
    netflix.ts          Netflix /viewingactivity scraper
    prime.ts            Prime Video watch-history scraper
    hulu.ts             Hulu /account/watch-history scraper
    disney.ts           Disney+ /watchlist scraper
  vite.config.ts        Rollup entry-map + copy manifest/popup.html
```

## When scrapers break

Each content script starts with a `waitFor()` sentinel selector — if
it times out the scraper throws and the popup surfaces
`"Netflix: no rows found. DOM may have changed."`. When that happens,
update the selectors in the matching `content/<service>.ts`.
