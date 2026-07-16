# Migrate Slate off Supabase onto Neon Postgres

**Date:** 2026-07-15
**Status:** Draft — awaiting review
**Owner:** Nish

## Problem

Slate's data lives on Supabase's free (hobby) plan. That plan allows only **2
active projects per organization**, and this is Nish's 3rd project, so it gets
force-paused regardless of activity. (The free tier *also* auto-pauses any
project after 7 days of inactivity.) A keep-alive ping cannot fix a
project-count cap — the project has to leave Supabase entirely.

## Goal

Move this app's database to a provider that is:

- **Free**, and doesn't count against Supabase's 2-project limit,
- **Never manually paused** — wakes automatically on demand,
- **Same performance** and identical app behavior.

Target: **Neon** serverless Postgres. It's a different provider (frees up the
Supabase slot), free-tier generous for a personal library, Postgres→Postgres
(schema + data port near-verbatim), Vercel-Marketplace native, and its compute
**auto-resumes on the next query** instead of entering a paused state that needs
a manual "restore" click.

## Non-goals (explicitly out of scope)

- **No ORM/query-builder rewrite.** We are *not* moving call sites to Drizzle,
  Kysely, or raw SQL. That would touch ~19 files and force a rebuild of demo
  mode for no functional gain on a stable app.
- **No retirement of the self-host PostgREST stack.** `docker-compose.yml`
  (Postgres + PostgREST + Caddy) stays exactly as-is. Unifying self-host onto a
  direct-Postgres driver is a tempting future simplification but is unrelated to
  the pausing problem.
- **Backfill scripts** (`scripts/backfill-*.ts`) are not part of the runtime
  adapter (see "Backfill scripts" below).

## How the data layer works today (context)

Every database access funnels through a **single seam**: the `supabase`
singleton exported from `lib/supabase.ts`. ~19 files import it; none construct
their own client (except the standalone backfill scripts). The app uses **only**
the Postgres database — no Supabase Auth, Storage, Realtime, or RPC. RLS is off;
the server-side service-role key is the only credential.

Crucially, `lib/supabase.ts` already **selects between client implementations**:

- `NEXT_PUBLIC_DEMO_MODE=1` → `lib/demo-client.ts`, an in-memory client that
  **reimplements the exact query-builder surface the app uses** (cookie-backed).
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → real `@supabase/supabase-js`.
- Neither → a no-op stub that returns empty results.

`demo-client.ts` is the proof-of-concept for this migration: a swap-in client
behind the same interface is a pattern the codebase **already ships**. We add a
third sibling backed by Neon.

## Chosen approach: a Neon-backed adapter behind the existing seam

Add `lib/neon-client.ts` — a client exposing the **same** `from(table)…` builder
as `demo-client.ts`, but translating each chain into parameterized SQL executed
against Neon via `@neondatabase/serverless`. Then extend the selector in
`lib/supabase.ts`:

```
NEXT_PUBLIC_DEMO_MODE=1          → demo client            (unchanged)
DATABASE_URL present             → NEW Neon client        (new primary)
SUPABASE_URL + service-role key  → supabase-js            (unchanged fallback)
otherwise                        → stub                   (unchanged)
```

`DATABASE_URL` (Neon) **takes precedence** over `SUPABASE_URL` when both are
set. The Neon client is loaded via dynamic `require` (mirroring
`buildDemoClient`) so it's excluded from bundles that don't use it.

**Nothing else changes** — no call site, page, server action, demo mode, or
self-host path is touched. Rollback is a single env var.

### Driver choice — `pg` (node-postgres), revised from the original plan

Implemented with **`pg`** (node-postgres), not `@neondatabase/serverless`.
Rationale: `pg` speaks the standard Postgres wire protocol, so the *same* client
works against Neon (via the pooled connection string), any local/self-host
Postgres, and an in-memory engine (`pg-mem`) for tests. The Neon HTTP driver is
Neon-only and can't be exercised without a live Neon account — which would have
left the whole adapter unverifiable before shipping. `pg` also keeps the project
portable, in line with its existing self-host philosophy. Cold-start difference
vs the HTTP driver is negligible for a personal app (and dwarfed by Neon's own
compute-resume latency).

Config: pooled `DATABASE_URL` (host contains `-pooler`, `?sslmode=require`); a
lazy module-level `Pool` singleton (`max: 10`, idle timeout, mandatory `error`
handler). Type coercion to match PostgREST is done with process-global `pg` type
parsers (numeric→number, timestamptz→ISO string, date→`YYYY-MM-DD` string);
`pg` is this project's only pg consumer and the module only loads when Neon is
active, so the global parsers are safe.

Build-time safety: the `Pool` is created lazily inside `getPool()` (first query),
and `lib/supabase.ts` only requires `lib/neon-client.ts` when `DATABASE_URL` is
set — so `next build` never touches `pg` when the var is absent. Verified: build
passes with the existing supabase-js env.

### Verification performed (code side)

- `tsc --noEmit` and `eslint` clean.
- **38/38** generated-SQL execution tests against a real Postgres engine
  (`pg-mem`) seeded with `supabase/schema.sql`, covering every call site: upsert
  + `ON CONFLICT DO UPDATE`/`DO NOTHING` + `RETURNING`, all selects,
  `single`/`maybeSingle`/PGRST116, `in`/`ilike`/`order`/`limit`, jsonb writes,
  the `"duplicate"` error contract, and injection/full-table-write guards. The
  one path `pg-mem` can't run (`row_to_json(e.*)`, a standard Postgres builtin)
  had its JOIN/filter proven by a direct-join check and runs natively on Neon.
- `next build` passes (compile + `server-only` client/server boundary + static
  generation), confirming `pg` never enters a client bundle.
- Adversarial multi-lens review (SQL correctness, PostgREST-equivalence,
  security, ops/migration) with per-finding verification.
- **Remaining:** live smoke test against Neon with migrated data — the user's
  final step, since provisioning Neon requires their account.

### Next.js integration (discovered & handled during implementation)

Three Next-specific issues surfaced when running the neon path through a real
`next build`; all are fixed:

1. **Dynamic rendering.** A `pg` query is raw TCP, invisible to Next's dynamic
   detection — unlike supabase-js's `fetch`. Without a signal, DB-reading pages
   with no other dynamic marker (`/`, `/watching`, `/watched`) would be
   statically prerendered and serve a stale/empty library after deploy.
   `lib/neon-client.ts` calls `await connection()` (from `next/server`) before
   every read, opting those renders out of prerendering — the drop-in-faithful
   equivalent of what supabase-js's fetch did, and crucially **not**
   `export const dynamic = "force-dynamic"`, which would flip the cached TMDB
   fetches to `no-store` (see the warning in `lib/tmdb.ts`). Net effect: on Neon,
   these pages render fresh per request (an improvement — under supabase-js they
   prerender static and can show stale data until a mutation revalidates).
2. **Driver bundling.** Turbopack bundles a static `import "pg"` and mangles its
   `pg-types` internals (throws at module eval; `serverExternalPackages` alone
   didn't prevent it under Turbopack). Fixed by loading pg through a real Node
   `require` created lazily inside `getPool()` (`createRequire(import.meta.url)`),
   plus `serverExternalPackages: ["pg"]` in `next.config.ts` for output tracing.
3. **Lazy client construction.** `lib/supabase.ts` now builds the backend client
   on first `.from()` (a small lazy facade) instead of at module load, so Next's
   "collect page data" pass — which imports every route module — never
   constructs the client or touches pg at build time.

Verified: `next build` passes with the neon path; `/`, `/watching`, `/watched`
are `ƒ` (Dynamic) and absent from the prerender manifest; a runtime `next start`
with a dummy `DATABASE_URL` loads pg and degrades gracefully (HTTP 200 +
"Couldn't reach the database"); and the default supabase-js build still passes.

### Known follow-up (resolved)

`scripts/backfill-ratings.ts` / `scripts/backfill-seasons.ts` used to build their
own supabase-js client and hard-require `SUPABASE_URL`; on a Neon-only deployment
they exit(1). **Now ported:** both select a backend with the same precedence as
`lib/supabase.ts` (`DATABASE_URL` → direct `pg`; else `SUPABASE_URL` +
service-role key → supabase-js) via the shared `scripts/lib/backfill-db.ts`. The
runtime seam is untouched — the scripts use a direct `pg` connection rather than
`lib/neon-client.ts`, which depends on `next/server`'s `connection()` and only
works inside Next.

## Adapter surface (exact, enumerated from current usage)

The runtime surface is small and closed. `demo-client.ts` already implements
~90% of it; the Neon client mirrors it against SQL.

**Reads** — `.from(t).select(cols)` then any of `.eq` · `.in` · `.ilike` ·
`.order(col,{ascending})` · `.limit(n)` · `.single()` · `.maybeSingle()`:

- `cols` seen in practice: `*`, `id`, `favorite`, `tmdb_id`, `id, name`,
  and the two embeds below.
- **Embeds on `list_titles`:** `title_id, position, titles(*)` and
  `list_id, titles(poster_path)` → LEFT JOIN `titles`, nesting the joined row
  as a `titles` object (or `null`), matching PostgREST's embedded-resource shape.

**Writes:**

- `.insert(obj)` — fire-and-forget (`createList`, `addTitleToList`) or chained
  `.select("id, name").single()` (`createListAndAddTitle`).
- `.upsert(obj, { onConflict, ignoreDuplicates })` → `INSERT … ON CONFLICT
  (cols) DO UPDATE` (when `ignoreDuplicates:false`, e.g. `addTitle`) or `DO
  NOTHING` (when `true`, e.g. bulk import). `onConflict` is always
  `"tmdb_id,media_type"`. Supports the chained `.select("id").single()`
  (RETURNING) and the bulk array form (`import-actions.ts`).
- `.update(patch).eq("id", id)`.
- `.delete().eq("id", id)` and `.delete().eq("list_id",…).eq("title_id",…)`.

Tables are a fixed allowlist (`titles`, `lists`, `list_titles`); columns are
known. **Identifiers are interpolated from this allowlist; every value is a
parameterized placeholder (`$1,$2,…`)** — no user input reaches SQL as text.

## Correctness contracts the adapter MUST preserve

These are behaviors current callers depend on. A raw Postgres driver differs
from PostgREST here, so the adapter normalizes:

1. **`numeric` → JS `number`.** PostgREST returns `numeric` as numbers; raw pg
   drivers return **strings**. The app treats `rating`, `tmdb_rating`,
   `imdb_rating` as numbers (`formatTmdbScore()` etc.). Coerce these columns to
   `number` (via `::float8` cast or a row post-processor). Integer columns
   (`runtime`, `*_votes`, `*_score`, `tmdb_vote_count`) already parse to numbers.
2. **`timestamptz` → ISO string.** PostgREST and `demo-client` return ISO
   strings (`added_at`, `watched_at`, `created_at`, `ratings_fetched_at`); raw
   drivers return `Date` objects. Coerce to ISO strings.
3. **`jsonb` (`genres`, `seasons`)** — return as parsed JS objects (driver does
   this natively); ensure writes serialize objects to JSON.
4. **Unique-violation error message contains `"duplicate"`.**
   `addTitleToList` / `createListAndAddTitle` swallow the error only when
   `error.message.includes("duplicate")`. Map Postgres error `23505` to a
   message containing that word.
5. **`.single()` with no row →** `{ data: null, error: { message, code:
   "PGRST116" } }` (matches supabase-js + demo-client); `.maybeSingle()` with no
   row → `{ data: null, error: null }`.
6. **Return shape** is always `{ data, error }`, and the builder is **thenable**
   (awaitable), exactly like `demo-client`. Mutations without a chained
   `.select()` resolve `{ data: null, error }`.
7. On any DB error, resolve (don't throw) `{ data: null, error: { message } }` —
   callers do `if (error) throw new Error(error.message)`.

## Data migration

One-time Postgres→Postgres copy of three tables: `titles`, `lists`,
`list_titles`.

1. **Create schema on Neon** — run `supabase/schema.sql` against the Neon
   database. It's standard Postgres (`pgcrypto` for `gen_random_uuid()`, `jsonb`,
   `numeric`, check constraints, FKs) — Neon supports `create extension if not
   exists pgcrypto`.
2. **Export from Supabase** — the project is likely paused (2-project cap);
   **restore it once** in the Supabase dashboard to get a live *direct*
   connection string (Settings → Database → Connection string → URI, the 5432
   direct URL). Then copy the data. Two options:
   - **No extra tooling (recommended here — the dev box has no psql/pg_dump):**
     `scripts/migrate-to-neon.mjs`, which uses the already-installed `pg` to copy
     all three tables (FK-safe order, idempotent `ON CONFLICT DO NOTHING`, jsonb
     handled, with a row-count check). `--init` also applies the schema first:
     ```
     SOURCE_DB_URL="postgres://…supabase…" \
     DATABASE_URL="postgres://…neon…?sslmode=require" \
     node scripts/migrate-to-neon.mjs --init
     ```
   - **Classic:** `pg_dump --data-only --no-owner -t titles -t lists -t
     list_titles "$SUPABASE_DB_URL" | psql "$NEON_DB_URL"` (requires
     `brew install libpq`).
3. **Verify row counts** match on both sides before cutting over (the script
   prints this automatically).

## Provisioning & environment

- Provision Neon via the **Vercel Marketplace** (`vercel integration add neon`
  or the dashboard) — it auto-creates the database and injects `DATABASE_URL`
  into the linked project. Pick the **region matching the Vercel function
  region** to keep latency low.
- Document `DATABASE_URL` in `.env.example` under the Postgres section, noting it
  takes precedence over `SUPABASE_URL` and that self-host/Supabase remain
  supported fallbacks.
- Local dev options: a Neon dev **branch** (`DATABASE_URL` → branch), or the
  existing compose self-host stack (unchanged). Hosted Supabase for local dev
  goes away with the migration.

## Backfill scripts

`scripts/backfill-seasons.ts` and `scripts/backfill-ratings.ts` are already-run,
one-off maintenance tools that use `.is` / `.or` (which the runtime adapter
deliberately doesn't implement). **Out of scope** for the *runtime* adapter, but
now runnable on Neon: they share `scripts/lib/backfill-db.ts`, which opens a
direct `pg` connection from `DATABASE_URL` (raw SQL for the `IS NULL` / `OR`
filters) and falls back to supabase-js when only `SUPABASE_URL` is set — same
precedence as the seam.

## Verification plan

Against a Neon database seeded with the migrated data (or a Neon branch),
exercise every flow and compare with current behavior:

- Home rails + Watchlist/Watching/Watched grids and FilterBar
- Add title (upsert + RETURNING id), preview-add redirect, status via dropdown
- Set status / rating / review / toggle favorite / remove title
- Lists: create, create-and-add, add-to-list, remove-from-list, delete list,
  the `titles(*)` and `titles(poster_path)` embeds on the lists pages
- Search (`ilike` + `savedAmong` `in`), command palette
- Watched stats (numeric averages — confirms the `numeric→number` coercion)
- Bulk import (`upsert` array with `ignoreDuplicates:true`)
- Regression: demo mode and self-host (compose) still work unchanged

## Rollback

Because the change is additive and the supabase-js path is retained, rollback is
unsetting `DATABASE_URL` (falls back to `SUPABASE_URL`) — no code revert needed.

## Open questions

- None blocking. Confirm the Vercel project region so Neon is provisioned in the
  same region.
