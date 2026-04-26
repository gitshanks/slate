<div align="center">

# slate

**Your personal Letterboxd.** A fast, private watchlist for everything you want to watch — and everything you've loved.

<p>
  <a href="#self-host"><img alt="Self-host" src="https://img.shields.io/badge/self--host-docker-2496ED?style=flat-square"></a>
  <a href="#deploy-to-vercel"><img alt="Deploy" src="https://img.shields.io/badge/deploy-vercel-000?style=flat-square"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000?style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</p>

<img width="1518" alt="slate — watchlist" src="https://github.com/user-attachments/assets/003b1ef9-0ccb-45e1-80f7-529f9f358ccf" />

</div>

---

## Why slate

Letterboxd is great, but it's social. Slate is the opposite: a single-user watchlist designed to feel like a personal app, not a network. Run it in Docker on your own box, or deploy it to Vercel in five minutes — either way, the data is yours.

## Features

- **⌘K command palette** — search TMDB and add anything to your library in one keystroke
- **Three clean states** — Watchlist, Watching, Watched, with Love / Like / Dislike ratings and private notes
- **Critic scores you can trust** — IMDb rating + Rotten Tomatoes Tomatometer (with Metacritic fallback) on every saved title, fetched once via OMDB and cached
- **Custom lists** — curate collections like _"Cozy winter"_ or _"A24 horror"_
- **Rich title pages** — cast, streaming providers, TMDB reviews, trailers
- **One-step import** from Letterboxd or Trakt CSV exports — [`/import`](#import)
- **Passcode gate** — optional shared-cookie lock for private deployments
- **Responsive, themeable** — looks good on every screen, dark or light

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · Postgres + PostgREST · TMDB API · Docker / Vercel

<img width="1493" alt="slate — title detail" src="https://github.com/user-attachments/assets/136629c4-b999-4e4c-82d6-56ddd8e6186f" />

## Self-host

Slate is designed to be self-hosted. Everything runs on your machine and your data never leaves it — the only outbound calls are to TMDB for metadata.

### One command

```bash
git clone https://github.com/gitshanks/slate.git
cd slate
cp .env.example .env          # fill in TMDB_API_KEY + OMDB_API_KEY
docker compose up -d
```

Open <http://localhost:3000>. Done.

You'll want two free keys before you start:

- **TMDB** ([themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)) — required. Drives metadata, posters, search, cast, providers, recommendations.
- **OMDB** ([omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)) — strongly recommended. Drives the IMDb / Rotten Tomatoes / Metacritic chips on saved titles. 1,000 lookups/day is plenty for a personal library; results are cached for 24h. Skip it and the app still runs, but every rating chip stays blank.

### What's inside

| Service | Image | What it does |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Your database. One named volume. |
| `postgrest` | `postgrest/postgrest` | REST API over the tables. |
| `caddy` | `caddy:2-alpine` | Maps `/rest/v1/*` → PostgREST so the Supabase client works unchanged. |
| `slate` | built from `./Dockerfile` | The Next.js app. The only service exposed to the host. |

### Data ownership

All your titles, ratings, and notes live in the `postgres_data` volume.

```bash
# Back up
docker compose exec postgres pg_dump -U slate slate > slate.sql

# Restore
cat slate.sql | docker compose exec -T postgres psql -U slate slate

# Wipe everything
docker compose down -v
```

### Production notes

- Put Caddy or Traefik in front of the `slate` container for TLS and a real domain.
- Set `APP_PASSCODE` in `.env` to gate access behind a shared code.
- The stack is single-user by design. If you want to expose it publicly, keep the passcode on.
- PostgREST runs without JWT auth inside the compose network — don't expose port 3001 to the internet.

## Deploy to Vercel

Prefer a managed stack? Slate deploys to Vercel + Supabase unchanged.

### 1. Clone

```bash
git clone https://github.com/gitshanks/slate.git
cd slate && npm install
```

### 2. Get your keys

| Service | What you need | Where |
|---|---|---|
| **TMDB** | v3 API key (free, instant) — required | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **OMDB** | API key (free, 1k lookups/day) — recommended; powers IMDb / RT / Metacritic chips | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) |
| **Supabase** | Project URL + `service_role` key — required | [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** |

Then open the Supabase **SQL editor** and paste in [`supabase/schema.sql`](./supabase/schema.sql). That's the entire database.

### 3. Deploy

Push to GitHub, import at [vercel.com/new](https://vercel.com/new), and add these environment variables:

| Variable | | Purpose |
|---|---|---|
| `TMDB_API_KEY` | required | TMDB v3 key |
| `SUPABASE_URL` | required | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | required | Server-only secret |
| `OMDB_API_KEY` | recommended | Powers IMDb / Rotten Tomatoes / Metacritic chips on saved titles. Without it, those stay blank — everything else still works. |
| `APP_PASSCODE` | optional | Lock the app behind a shared passcode. Omit for public. |

### 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. Without `APP_PASSCODE`, the unlock screen is skipped.

> **Pro tip — public _and_ private from one repo.** Import the same GitHub repo twice in Vercel. Set `APP_PASSCODE` on one project for your personal copy; leave it unset on the other for a portfolio-friendly public demo. Both stay in sync on every push.

## Backfilling ratings on an existing library

If you set `OMDB_API_KEY` after already adding titles, run this once locally to fetch IMDb / Rotten Tomatoes / Metacritic for every existing row:

```bash
npx tsx scripts/backfill-ratings.ts
```

It reads `.env.local` / `.env` for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`, and `OMDB_API_KEY`, then walks every saved title that's missing a rating. Throttled to ~3 calls/sec — comfortably inside the free tier — and re-runnable, since it skips rows that already have data.

## Import

Coming from another tracker? Drop a CSV into `/import`:

- **Letterboxd** — Settings → Data → Export your data. Import `watched.csv`, `ratings.csv`, or `watchlist.csv`.
- **Trakt** — any movie/show CSV export.

Rows are matched against TMDB, deduped against your library, and dropped into the right state with ratings preserved.

## Project layout

```
app/
  (app)/              # main app — protected by passcode when set
    page.tsx          #   /              Watchlist
    watching/         #   /watching
    watched/          #   /watched
    title/[id]/       #   /title/:id
    lists/            #   /lists, /lists/:slug
    discover/         #   /discover
    import/           #   /import
    person/[id]/      #   /person/:id
  unlock/             # passcode screen
  api/tmdb/search/    # server-side TMDB proxy
  layout.tsx          # root shell + ThemeProvider + Sonner
  globals.css         # design tokens (HSL → @theme inline)
components/
  ui/                 # shadcn/ui primitives
  command-palette.tsx
  poster-card.tsx
  backdrop-hero.tsx
  review-sheet.tsx
  ...
lib/
  supabase.ts         # server-only client + generated types
  tmdb.ts             # TMDB fetch helpers
  actions.ts          # Server Actions — all mutations
proxy.ts              # passcode gate (Next.js proxy)
supabase/schema.sql   # one-shot DB setup
docker-compose.yml    # self-host stack
Dockerfile            # Next.js standalone runner image
```

## Security

- `SUPABASE_SERVICE_ROLE_KEY` is imported only from `lib/supabase.ts`, which carries `import "server-only"` — it can never leak into a client bundle.
- `TMDB_API_KEY` never touches the browser. The command palette routes through `/api/tmdb/search`.
- The passcode gate uses a signed shared cookie — fine for single-user deployments. For multi-user, swap in Supabase Auth + RLS.

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Poster and backdrop artwork is served from TMDB's CDN.

## Roadmap

- **Jellyfin library integration** — show what you already own in slate, matched via TMDB IDs. Coming soon.

## What slate doesn't do (yet)

- **Multi-user accounts** — slate is single-user by design. A passcode is the only access control.
- **Plex library integration.**
- **Trakt / MyAnimeList sync** — CSV one-shot import only.
- **Native mobile apps** — PWA install is supported on iOS Safari and Chromium.
- **Library export** — you can import a library but can't yet dump one out.

## License

MIT. Fork it, host it, make it yours.
