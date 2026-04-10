# cinephile

A private, sleek watchlist for movies and TV shows. Like Letterboxd, but for one
person — yours.

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**,
**Supabase Postgres**, and the **TMDB API**. Designed dark-first, minimal,
futuristic. Hosted on **Vercel**.

## Features

- Cmd+K command palette to search TMDB and add titles instantly
- Watchlist + Watched + Dropped + Watching states
- Half-star ratings + free-form notes per title
- Custom lists (e.g. "Cozy winter", "A24 horror")
- Single-user passcode gate via Next.js proxy middleware
- Fully responsive grid, dark/light theme switch
- Server Actions everywhere — no API plumbing

## Setup

### 1. Install

```bash
npm install
```

### 2. Get a TMDB API key

1. Sign up at <https://www.themoviedb.org/signup>
2. Visit <https://www.themoviedb.org/settings/api> and request a key (the
   "Developer" option is instant and free)

### 3. Create a Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**
2. After it provisions, open **SQL editor** and run the contents of
   [`supabase/schema.sql`](./supabase/schema.sql)
3. Open **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configure env vars

```bash
cp .env.local.example .env.local
```

Fill in:

```
TMDB_API_KEY=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
APP_PASSCODE=             # leave blank locally if you want to skip unlock
```

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it on <https://vercel.com/new> — Vercel auto-detects Next.js.
3. Add the four env vars from `.env.local.example` in **Project Settings → Environment Variables**.
4. Set `APP_PASSCODE` to a real value (the app is publicly reachable on Vercel).
5. Deploy.

## Project layout

```
app/
  (app)/             # everything that requires unlock
    page.tsx         # /            Watchlist
    watched/         # /watched
    title/[id]/      # /title/:id
    lists/           # /lists, /lists/:slug
    layout.tsx       # TopNav + CommandPalette mount
  unlock/            # passcode screen
  api/tmdb/search/   # server proxy for TMDB search
  layout.tsx         # root html shell + ThemeProvider + Sonner
  globals.css        # design tokens (HSL → @theme inline)
components/
  ui/                # shadcn primitives (copied from ui-library)
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
  actions.ts         # Server Actions for all mutations
  utils.ts
proxy.ts             # passcode gate (was middleware.ts in Next 15)
supabase/schema.sql  # one-shot DB setup
```

## Security notes

- The Supabase **service role key** is referenced only from `lib/supabase.ts`,
  which has `import "server-only"` at the top. It can never end up in a client
  bundle.
- The TMDB API key never reaches the client either — the command palette calls
  `/api/tmdb/search`, which proxies through the server.
- The proxy passcode gate is intentionally minimal (a single shared cookie). If
  you want real auth, swap in Supabase Auth + RLS later.
