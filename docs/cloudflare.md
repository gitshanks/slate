# Running Slate on Cloudflare Workers

This branch lets Slate run on Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`). Vercel and self-host (Docker) keep working.

## What changed

- **Next.js 16.2.3 → 16.4.6.** The adapter needs 16.4.5 or later. The
  `experimental.viewTransition` flag was removed in 16.3; view transitions now
  work without it, so the flag is gone from `next.config.ts`.
- **`lib/neon-client.ts`.** Workers can't reuse a socket opened by one request
  in another request, so a process-wide `pg` Pool breaks there. On Workers each
  query or transaction now opens a one-connection pool and closes it when done.
  Neon's pooled URL (pgbouncer) keeps that cheap. Node and Docker keep the
  shared pool exactly as before.
- **Build id.** `NEXT_PUBLIC_BUILD_ID` also reads `WORKERS_CI_COMMIT_SHA`, so
  the stale-tab banner keeps working on Workers Builds.
- **Caching.** `open-next.config.ts` stores ISR and `unstable_cache` data in R2,
  keeps `revalidatePath()` tags in D1, and runs time-based revalidation
  (`export const revalidate = …`) through a Durable Object queue.
- New scripts: `npm run cf:build`, `npm run cf:preview`, `npm run cf:deploy`.

## One-time setup in Cloudflare

1. Create the R2 bucket: `npx wrangler r2 bucket create slate-opennext-cache`
2. Create the D1 database: `npx wrangler d1 create slate-opennext-tags`, then
   paste its id into `wrangler.jsonc` in place of `REPLACE_WITH_D1_DATABASE_ID`.
   The deploy command creates the table it needs.
3. Durable Objects need the Workers Paid plan. The worker is about 3.9 MB
   gzipped, which is over the free plan's 3 MB limit anyway.

## Workers Builds (Git integration)

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Non-production branch deploy command: `npx opennextjs-cloudflare upload`

## Environment variables

`NEXT_PUBLIC_*` values are read at build time, so set them as **build**
variables. Everything else is read at runtime, so set it on the Worker
(secrets for keys).

- Build: `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_SLATE_HOSTED`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POSTHOG_HOST`,
  `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_UI_HOST`
- Secrets: `DATABASE_URL`, `AUTH_SECRET`, `NATIVE_AUTH_SECRET`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `TMDB_API_KEY`,
  `OMDB_API_KEY`, `YOUTUBE_API_KEY`, `RESEND_API_KEY`, `AUTH_RESEND_KEY`,
  `APPLE_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSCODE`
- Plain vars: `AI_PROVIDER`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`,
  `OPENAI_BASE_URL`, `GEMINI_MODEL`, `APPLE_KEY_ID`, `APPLE_SERVICE_ID`,
  `APPLE_TEAM_ID`, `NATIVE_AUTH_ISSUER`, `AUTH_EMAIL_FROM`, `EMAIL_FROM`,
  `PRIVACY_CONTACT_EMAIL`, `SLATE_ADMIN_EMAILS`, `SLATE_LEGACY_OWNER_EMAIL`,
  `SUPABASE_URL`

A second deploy (for example the public demo beside the hosted app) needs its
own Worker, because the `NEXT_PUBLIC_*` flags are baked in at build time.

## The database

The Neon database was provisioned through the Vercel Marketplace. Before
cancelling Vercel, move it to a Neon-owned account (Neon supports transferring
Vercel-managed projects) or confirm it survives the Vercel plan change, and copy
`DATABASE_URL` into the Worker.

## What was checked

- `opennextjs-cloudflare build` succeeds, including the TypeScript check.
- Local Workers preview against a throwaway Postgres loaded with
  `supabase/schema.sql` and the migrations: `/`, `/landing`, `/privacy`,
  `/api/version` and the manifest return 200, `/` shows rows from the database,
  and six parallel requests all succeed.

Not checked yet: sign-in (Auth.js, Apple, email codes), writes and
transactions, TMDB-backed pages, the AI features, and time-based revalidation
on a real deploy.
