# slate

A sleek personal watchlist for movies and TV shows. Like Letterboxd, but yours.

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, **Supabase Postgres**, and the **TMDB API**. Designed dark-first, minimal, responsive. Hosted on **Vercel**.

## Features

- Cmd+K command palette to search TMDB and add titles instantly
- Watchlist / Watching / Watched states with sentiment ratings
- Half-star ratings + free-form notes per title
- Custom lists (e.g. "Cozy winter", "A24 horror")
- Cast pages, streaming provider lookup, TMDB reviews
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
