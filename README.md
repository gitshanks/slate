<div align="center">

# slate

**Your personal Letterboxd.** A fast, private watchlist for everything you want to watch and everything you've loved.

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

Letterboxd is great, but it's social. Slate is the opposite: a single-user watchlist that feels like a personal app, not a network. Run it in Docker on your own box, or deploy it to Vercel in five minutes. Either way, the data is yours.

## Features

- **⌘K command palette:** search TMDB and add anything to your library in one keystroke
- **AI search:** flip the "Ask AI" pill (or ⌘⇧K) and type plain English like _"cozy autumn mysteries"_, _"A24 horror after 2020"_, or _"Nolan thrillers"_. Live query suggestions surface as you type. Powered by any OpenAI-compatible endpoint (Groq's free tier running Llama 3.3 70B by default) or Claude. Optional; drop in one key to enable
- **Three clean states:** Watchlist, Watching, Watched, with Love / Like / Dislike ratings and private notes
- **Episode tracking without the chore:** for the shows you're watching, slate stores where you are (S2·E5), not every episode you've ticked off. Tap the chip on the card to advance one episode; on the title page, tap any episode in the season grid to set "I'm caught up to here." Two clicks to recover after a binge
- **Critic scores you can trust:** IMDb rating + Rotten Tomatoes Tomatometer (with Metacritic fallback) on every saved title, fetched once via OMDB and cached
- **Custom lists:** curate collections like _"Cozy winter"_ or _"A24 horror"_
- **Rich title pages:** cast, streaming providers, TMDB reviews, trailers
- **One-step import** from Letterboxd or Trakt CSV exports — [`/import`](#import)
- **Passcode gate:** optional shared-cookie lock for private deployments
- **Themeable:** System, Light, or Dark mode via the three-way toggle; six accent color palettes to pick from (violet, indigo, sky, emerald, rose, amber)
- **Responsive:** looks good on every screen size

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · Postgres — Neon (Vercel) or PostgREST (self-host) · TMDB API · Docker / Vercel

<img width="2560" height="1296" alt="slate — title page" src="https://github.com/user-attachments/assets/3247d633-123c-4325-b8be-a0f452b8d89d" />

## Self-host

Slate is designed to be self-hosted. Everything runs on your machine and your data never leaves it. The only outbound calls are to TMDB for metadata.

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
| `caddy` | `caddy:2-alpine` | Maps `/rest/v1/*` to PostgREST so the Supabase client works unchanged. |
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
- PostgREST runs without JWT auth inside the compose network, so don't expose port 3001 to the internet.

## Deploy to Vercel

Prefer a managed stack? Slate deploys to Vercel + Neon — free serverless Postgres that never pauses — in a few minutes.

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

The database is **Neon** — free serverless Postgres that (unlike Supabase's hobby tier) never pauses and doesn't cap you at two projects. You provision it from inside Vercel in the next step, so there's no key to grab up front.

### 3. Deploy

Push to GitHub and import at [vercel.com/new](https://vercel.com/new). Then, inside the project:

1. **Add the database.** **Storage → Create Database → Neon** (Vercel Marketplace). Pick the same region as your project — it provisions a free Neon Postgres and sets `DATABASE_URL` for you automatically.
2. **Load the schema.** In the [Neon console](https://console.neon.tech) → **SQL Editor**, paste [`supabase/schema.sql`](./supabase/schema.sql) and run it. That's the entire database. Re-running is safe — every `create` / `alter` uses `if not exists`, so it picks up new columns without touching your data.
3. **Add the rest of the environment variables** (Settings → Environment Variables):

| Variable | | Purpose |
|---|---|---|
| `TMDB_API_KEY` | required | TMDB v3 key |
| `DATABASE_URL` | required | Neon Postgres connection — **set automatically** by the Marketplace integration above. Add by hand only if you bring your own Neon/Postgres: use the pooled (`-pooler`) URL with `?sslmode=require`. |
| `OMDB_API_KEY` | recommended | Powers IMDb / Rotten Tomatoes / Metacritic chips on saved titles. Without it, those stay blank but everything else still works. |
| `OPENAI_API_KEY` | optional | Unlocks AI search in the ⌘K palette for natural-language queries and live suggestions. Defaults to [Groq](https://console.groq.com/keys)'s free tier running Llama 3.3 70B; works with any OpenAI-compatible endpoint (OpenRouter, Ollama, LM Studio, vLLM, llama.cpp). Override the endpoint with `OPENAI_BASE_URL` and the model with `OPENAI_MODEL`. |
| `ANTHROPIC_API_KEY` | optional | Alternative AI backend; uses Claude instead of an open model. Set `AI_PROVIDER=anthropic` to prefer it when both keys are present. |
| `APP_PASSCODE` | optional | Lock the app behind a shared passcode. Omit for public. |
| `NEXT_PUBLIC_DEMO_MODE` | optional | Set to `1` on a portfolio or public-demo deploy. Skips the `APP_PASSCODE` gate, shows a demo banner, mounts a marketing landing page at `/`, and moves the watchlist to `/app`. Self-host default (unset) keeps the app at `/` so existing bookmarks and PWA installs are unaffected. |

Prefer Supabase, or already have another Postgres? Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` instead of `DATABASE_URL` — the data layer uses whichever backend is configured.

### 4. Run locally

Add `DATABASE_URL` to `.env.local` (copy it from the Neon dashboard, or run `vercel env pull .env.local`), then:

```bash
npm run dev
```

Open <http://localhost:3000>. Without `APP_PASSCODE`, the unlock screen is skipped.

> **Pro tip:** import the same GitHub repo twice in Vercel to get a public and private copy from one codebase. Set `APP_PASSCODE` on one project for your personal copy; on the public copy add `NEXT_PUBLIC_DEMO_MODE=1` to skip the passcode and mount a marketing landing page at `/`. Both stay in sync on every push.

## Backfilling an existing library

Two one-shot scripts cover the cases where a feature shipped after some titles were already in your database. Both read `.env.local` / `.env`, throttle to stay polite on the free TMDB / OMDB tiers, and skip rows that already have data, so they're safe to re-run.

```bash
# IMDb / Rotten Tomatoes / Metacritic for every saved title
npx tsx scripts/backfill-ratings.ts

# Per-season episode counts for every TV title — needed for the
# +1 chip and the season picker on title pages
npx tsx scripts/backfill-seasons.ts
```

## Import

Coming from another tracker? Drop a CSV into `/import`:

- **Letterboxd:** Settings → Data → Export your data. Import `watched.csv`, `ratings.csv`, or `watchlist.csv`.
- **Trakt:** any movie/show CSV export.

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
    search/           #   /search        keyword + AI search results
    import/           #   /import
    person/[id]/      #   /person/:id
    share/            #   /share         add-to-library deep link
  landing/            # marketing landing page (demo mode)
  unlock/             # passcode screen
  api/
    tmdb/search/      #   server-side TMDB proxy
    ai-suggest/       #   live AI query suggestions
    ai-chat/          #   natural-language AI search
    version/          #   build version probe
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
  ai-search.ts        # natural-language query parsing
  accent-theme.ts     # accent color palette config
  ...
proxy.ts              # passcode gate (Next.js proxy)
supabase/schema.sql   # one-shot DB setup
docker-compose.yml    # self-host stack
Dockerfile            # Next.js standalone runner image
```

## Security

- The database credential (`DATABASE_URL` for Neon, or `SUPABASE_SERVICE_ROLE_KEY`) is read only inside server-only modules (`lib/supabase.ts`, `lib/neon-client.ts`), so it can never leak into a client bundle.
- `TMDB_API_KEY` never touches the browser. The command palette routes through `/api/tmdb/search`.
- The passcode gate uses a signed shared cookie, which is fine for single-user deployments. For multi-user, swap in Supabase Auth + RLS.

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB. Poster and backdrop artwork is served from TMDB's CDN.

## Roadmap

- **Jellyfin library integration:** show what you already own in slate, matched via TMDB IDs. Coming soon.

## What slate doesn't do (yet)

- **Multi-user accounts:** slate is single-user by design. A passcode is the only access control.
- **Plex library integration.**
- **Trakt / MyAnimeList sync:** CSV one-shot import only.
- **Native mobile apps:** PWA install is supported on iOS Safari and Chromium.
- **Library export:** you can import a library but can't yet dump one out.

## License

MIT. Fork it, host it, make it yours.
