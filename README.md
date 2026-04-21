# slate

A sleek personal watchlist for movies and TV shows. Like Letterboxd, but yours.

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, **Supabase Postgres**, and the **TMDB API**. Designed dark-first, minimal, responsive. Hosted on **Vercel**.

## Features

- Cmd+K command palette to search TMDB and add titles instantly
- Watchlist / Watching / Watched states with sentiment ratings
- Half-star ratings + free-form notes per title
- Custom lists (e.g. "Cozy winter", "A24 horror")
- Cast pages, streaming provider lookup, TMDB reviews
- Bulk watch-history import via `/import` (CSV / TSV / JSON / plain text) or the included Chrome extension for Netflix, Prime Video, Hulu, and Disney+
- Optional passcode gate — deploy privately or leave open
- Fully responsive, dark/light theme

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/slate.git
cd slate
npm install
```

### 2. Get a TMDB API key

1. Sign up at <https://www.themoviedb.org/signup>
2. Visit <https://www.themoviedb.org/settings/api> → request a key (Developer, instant and free)

### 3. Create a Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**
2. Open **SQL editor** and run [`supabase/schema.sql`](./supabase/schema.sql)
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Deploy to Vercel

1. Push the repo to GitHub
2. Import it at <https://vercel.com/new> — Vercel auto-detects Next.js
3. In **Project Settings → Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `TMDB_API_KEY` | Your TMDB v3 API key |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role secret |
   | `APP_PASSCODE` | A passcode to gate access *(omit for a public deployment)* |

4. Deploy.

> **Tip — private + public deployments from one repo:** Import the same GitHub repo twice in Vercel. Set `APP_PASSCODE` on the private project for personal use. Leave it unset on the public project for a portfolio-friendly open version. Both stay in sync automatically on every push.

### 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. Without `APP_PASSCODE` set, the unlock screen is skipped automatically.

## Watch history import

Slate ships two ways to seed your library without adding titles one at a time.

### Web — any CSV / text file

Go to `/import`. Drop a file or paste titles; Slate sniffs the format (CSV / TSV / JSON / plain lines), matches each row against TMDB, and shows a review table so you can uncheck bad matches before committing. Supported sources include Netflix's `NetflixViewingHistory.csv`, Letterboxd's diary export, IMDb lists, Trakt JSON, and one-title-per-line text. Series episodes collapse into one `tv` row with the earliest watched date, and re-imports are idempotent thanks to the `(tmdb_id, media_type)` unique constraint.

### Chrome extension — Netflix, Prime Video, Hulu, Disney+

For services without a CSV export, the `extension/` directory contains a Manifest V3 Chrome extension that reads your already-logged-in history pages in your own browser session and pushes the titles back to Slate over an authenticated API.

**Build**

```bash
cd extension
npm install
npm run build
```

Output lands in `extension/dist/`.

**Install**

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select `extension/dist/` (or drag the folder onto the page).
4. Open the puzzle-piece menu in Chrome's toolbar and pin **Slate — Watch history sync**.

**Pair**

1. In Slate, visit `/settings` and copy the generated API token. (First visit to `/settings` seeds a token into the `app_settings` table.)
2. Click the pinned Slate icon → paste your Slate URL (e.g. `https://slate.yourdomain.com`) and the token → **Save**.

**Sync**

1. Open one of the supported history pages in the active tab:
   - Netflix — <https://www.netflix.com/viewingactivity>
   - Prime Video — <https://www.amazon.com/gp/video/library>
   - Hulu — <https://www.hulu.com/account/watch-history>
   - Disney+ — <https://www.disneyplus.com/watchlist>
2. Open the Slate popup → **Sync now** next to the matching service.
3. The popup logs `N saved — M unmatched`. Unmatched titles appear back on `/import` so you can retry them manually.

The extension is sideloaded only — no Chrome Web Store presence — so each code change requires rebuilding and clicking the refresh icon on the extension's card in `chrome://extensions`.

## Project layout

```
app/
  (app)/             # main app (requires unlock when passcode is set)
    page.tsx         #   /           Watchlist
    watching/        #   /watching
    watched/         #   /watched
    title/[id]/      #   /title/:id
    lists/           #   /lists, /lists/:slug
    layout.tsx       #   TopNav + CommandPalette
  unlock/            # passcode screen
  api/tmdb/search/   # server-side TMDB search proxy
  layout.tsx         # root HTML shell + ThemeProvider + Sonner
  globals.css        # design tokens (HSL → @theme inline)
components/
  ui/                # shadcn/ui primitives
  poster-card.tsx
  media-grid.tsx
  backdrop-hero.tsx
  star-rating.tsx
  status-pill.tsx
  command-palette.tsx
  review-sheet.tsx
  top-nav.tsx
  ...
lib/
  supabase.ts        # server-only Supabase client + types
  tmdb.ts            # TMDB fetch helpers
  actions.ts         # Server Actions (all mutations)
  utils.ts
proxy.ts             # passcode gate (Next.js proxy middleware)
supabase/schema.sql  # one-shot DB setup
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` lives only in `lib/supabase.ts`, which has `import "server-only"`. It can never reach a client bundle.
- `TMDB_API_KEY` never reaches the client — the command palette routes through `/api/tmdb/search` on the server.
- The passcode gate is a lightweight shared-cookie approach. For multi-user deployments, swap in Supabase Auth + RLS.
