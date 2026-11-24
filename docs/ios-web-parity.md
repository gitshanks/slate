# iOS against the web, November 2026

Compared screen by screen: the live site at s1ate.space in an iPhone-sized
browser (as a guest, dark) against the iOS app on origin/main (9c99f29) in the
Simulator, and the web code in this repo. Each iOS screen was then checked in
the Simulator (iPhone 17 Pro; iPad Pro 11-inch for the Library and Discover,
in dark and light) against its web screenshot.

Status: **done** on branch `ios-web-parity`. **Needs deploy**: built and
checked in the Simulator against preview data, but it calls a new `/api/v1`
route on this branch, so it only works once the web app is deployed with it.
**Not matched**: with the reason.

## App frame

| Web | iOS before | Status |
|---|---|---|
| Dock: Library, Discover, Previews, Lists, plus the add button; no tab lit on Profile | Library, Discover, Lists | done |
| Top bar: wordmark, the Shelf/Space switch on Library, the theme button, the avatar | mark + wordmark, avatar | done |
| Theme: Light, System, Dark, a throwable slider; the top-bar button shows the setting chosen (a phone or tablet for System) and opens the slider | dark only | done |
| Light mode colours (`:root` in `app/globals.css`) | none | done |
| Accent slider (six accents) | mint only | not matched, on purpose: mint is the only accent |

## Search and adding

| Web | iOS before | Status |
|---|---|---|
| The search field sits under the top bar on Library, Discover and Lists; the add button focuses it | a full-screen search page | done |
| The panel: search all results, ask about it, your slate's matches, "With" a person, films and series with a split Up Next button | catalogue and people only | done |
| A pasted link offers "Find movies & shows in this link" | a separate button | done |
| Search results page: All, Films, Series; posters; people | a poster grid | done |
| Ask Slate: a conversation with titles to open and add | none | done (`/api/v1/ai/chat`, already deployed) |

## Library

| Web | iOS before | Status |
|---|---|---|
| Four posters a row on a phone, a border in the shelf's tone, and under each the title, the shelf in small capitals and the year | three, posters only | done |
| Typing in the search field narrows the shelf | none | done |
| Space: every poster on one wrapping canvas, swelling near the middle | none | done (drag and pinch; details open as the title page rather than a card on the canvas) |
| Empty slate: Add a title, Pick a few, Import history | Add a title, Add from a link | done |
| Under five titles: "Pick a few" and "Import history" | Find titles, Add from a link | done (both need deploy) |

## Discover

| Web | iOS before | Status |
|---|---|---|
| "Discover" / "Find what's next", then Based on your library, Trending this week, Now playing | rails including one per streaming service | done (the service rails belong to the TV app) |
| Type and year under each poster | posters only | done |

## Previews (a new tab)

| Web | iOS before | Status |
|---|---|---|
| One trailer a screen, swiped; why it's here, name, year, type, genre, score; Up Next, add to a list, details, pause, sound | none | done, from the public feed (`/api/public/previews`) |
| "Based on your library" trailers and learning from what you skip | — | not matched: the signed-in feed and its learning are read from the web session; a native route is still to write |

## Lists

| Web | iOS before | Status |
|---|---|---|
| "Collections" / "Lists", New list, the empty message | similar | done |
| Cards: fanned posters on a wide cover, name, count, description, "Shared by"/"Shared with" | similar | done |
| New list: name, description, "Create and add titles", straight into adding | a form | done |
| Adding to a list searches any film or show; new ones go to Up Next | library only | done |
| Share list: people with access, a 30-day invite link, remove someone, leave | a link to the list | needs deploy |
| Joining from an invite link | — | not matched: `/join/<token>` opens on the web; the list then shows on iOS |
| "On TV" toggle on a list | — | not matched: it belongs to the TV app, with no native route |

## Lists by Slate

| Web | iOS before | Status |
|---|---|---|
| `/l/<slug>`: a still with the name, the words, the films ranked with a large faint number, each film's line, the note | name, description, posters | done (the still, lines and note need deploy; until then it shows the first poster row's data without them) |
| `/l`, the hub of every list | — | not matched: a public page outside the app, linked only from the signed-out home |

## Profile

| Web | iOS before | Status |
|---|---|---|
| Name, @username, joined date; three shelf counts that open the shelf | name, counts | done |
| Sharing: share your slate, the public link with Copy link | toggle, link | done |
| Appearance: the theme slider | none | done |
| Account: Data and privacy, Signed in with Sign out | sign out | done (privacy opens the web page; there is no analytics on iOS to switch off) |
| Delete account, typing DELETE to confirm | none | needs deploy |

## Title page

| Web | iOS before | Status |
|---|---|---|
| Share a title ("Thought you might like …", the public `/t` link) | none | done |
| Status, reaction (Love, Like, Dislike), note, lists, trailer, where to watch, cast, crew, recommendations, scores | same | already matched |
| Opens as a card over the shelf | a pushed page | not matched: iOS keeps the pushed page |

## First run

| Web | iOS before | Status |
|---|---|---|
| Picks: ten titles to keep or pass, then "A good beginning." with suggestions based on them | straight into an empty library | needs deploy |
| Import a Letterboxd, IMDb or Trakt CSV ("Bring your history."), posters arriving as a wall | none | needs deploy |

## Not matched, and why

- **Guest mode** ("Try it first, no account needed"). A web guest's slate lives
  behind a browser cookie; the native API only issues device sessions to
  signed-in accounts. It needs native guest sessions, and the merge on sign-up,
  on the server first.
- **Accent colours**, on purpose.
- **Signed-in Previews** and its learning, **joining from an invite**, **On TV**,
  **the `/l` hub**, **the title card over the shelf**: above.
- **Install the web app**, keyboard shortcuts and the admin Insights page:
  web only.

## New native routes on this branch

| Route | For |
|---|---|
| `DELETE /api/v1/me` | Delete account |
| `GET, POST /api/v1/onboarding`, `POST /api/v1/onboarding/suggestions` | First-run picks |
| `POST /api/v1/import/parse` (text/csv), `POST /api/v1/import` | Import history |
| `POST /api/v1/lists/{id}/invite`, `POST /api/v1/lists/{id}/leave`, `DELETE /api/v1/lists/{id}/members/{profileId}` | Sharing lists |
| `GET /api/v1/slate-lists/{slug}` now also returns `heroPath`, `note` and each title's `value` and `line` | Ranked Slate lists |

Each wraps the function the web already uses, run as the token's owner.
