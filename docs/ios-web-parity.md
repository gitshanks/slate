# iOS against the web, November 2026

Compared screen by screen: the live site at s1ate.space on an iPhone-sized
browser (as a guest, dark) against the iOS app on origin/main (9c99f29) in the
Simulator, and the web code in this repo. Mint is the only accent on iOS, so
the web's accent slider is the one web feature left out on purpose.

Status: **done** on branch `ios-web-parity`, **server** needs the new `/api/v1`
routes on this branch deployed first, **not matched** with the reason.

## App frame

| Web | iOS before | Status |
|---|---|---|
| Dock: Library, Discover, Previews, Lists, plus the add button | Library, Discover, Lists | to do |
| Top bar on Library: wordmark, Shelf/Space switch, theme button, avatar | wordmark and avatar | to do (Space: see Library) |
| Top bar elsewhere: wordmark, theme button, avatar, search field under it | wordmark and avatar | to do |
| Theme: Light, System, Dark (a throwable slider in Profile; the top-bar button shows the setting chosen, a phone for System) | dark only | to do |
| Light mode colours (`:root` in `app/globals.css`) | none | to do |
| Accent slider (six accents) | mint only | not matched, on purpose: mint is the only accent |

## Search and adding

| Web | iOS before | Status |
|---|---|---|
| The add button focuses the search field at the top of the page; results open under it | a full-screen search page | to do |
| The field searches your slate first (library matches), then films, series and people | catalogue and people only | to do |
| A pasted link offers "Find movies & shows in this link" | a separate "Add from a link instead" button | to do |
| "Ask about …": AI search answers in a conversation, with titles to add | none | to do (uses `/api/v1/ai/chat`) |

## Library

| Web | iOS before | Status |
|---|---|---|
| Under each poster: the title, the shelf in small capitals and the year | posters only | to do |
| Library search narrows the grid as you type | none | to do |
| Empty slate: "Add a title", pick a few, import your history | "Add a title", "Add from a link" | to do |
| Space view: every poster on one canvas you pan and zoom | none | to do (a pan-and-zoom canvas in SwiftUI) |
| Guest card "Keep your slate" | n/a | not matched: iOS has no guest mode (below) |

## Discover

| Web | iOS before | Status |
|---|---|---|
| "Find what's next" heading | none | to do |
| Rails with the title, type and year under each poster | posters only | to do |

## Previews (new tab)

| Web | iOS before | Status |
|---|---|---|
| A full-screen feed of trailers, swiped up and down; each with its source ("Trending this week"), name, year, type, genre and score; Up Next, add to a list, details, pause and mute | none | to do (public feed now; "Based on your library" picks need the server route) |

## Lists

| Web | iOS before | Status |
|---|---|---|
| "Lists" page with New list, empty message, list cards | similar | to do (copy and layout aligned) |
| Share a list with an invite link; people with access; leave a list | none | server |
| Lists by Slate hub (`/l`) and ranked list pages | one list, opened from a link | server (hub) / to do (ranked page) |

## Profile

| Web | iOS before | Status |
|---|---|---|
| Identity, three shelf counts | same | to do |
| Appearance group: Theme slider | none | to do |
| Account group: Data and privacy, Delete account | sign out only | to do (privacy opens the web page) / server (delete) |
| Username and public link editing | name only | to do |

## Title page

| Web | iOS before | Status |
|---|---|---|
| Episode progress for shows you're watching ("S2 · E5", tap to advance, season grid) | none | to do (uses `/api/v1/titles/{id}/progress`) |
| Share a title | none | to do |
| Reaction labels Loved / Liked / Disliked | Love / Like / Dislike | to do |

## First run

| Web | iOS before | Status |
|---|---|---|
| Picks: ten titles to keep or pass, then "A good beginning" with suggestions based on them | straight into an empty library | server |
| Import your Letterboxd, IMDb or Trakt CSV ("Bring your history.") | none | server |

## Not matched

- **Guest mode** ("Try it first, no account needed"). On the web a guest's slate
  lives in a browser cookie; the native API only issues device sessions to
  signed-in accounts. It needs a native guest session and a merge on sign-up
  on the server before iOS can offer it.
- **Accent colours**, on purpose (above).
- **Install the web app** (PWA) and the keyboard shortcuts: web-only.
