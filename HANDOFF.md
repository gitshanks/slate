# Watchlist — Session Handoff

## What this is
Personal Letterboxd-style app at `/Users/nishanksharma/watchlist`. Next.js 16 + React 19 + Tailwind v4 + Supabase + TMDB. Single-user, gated by passcode cookie. Plan lives at `/Users/nishanksharma/.claude/plans/cosmic-wibbling-micali.md`.

## Current state
Code is fully scaffolded per the plan. Verification was in progress when context ran out. The app builds; the unlock screen renders; submitting the passcode previously crashed at `createClient("", "")` because env vars are empty. **Most recent fix:** `lib/supabase.ts` now returns a thenable stub client when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing, so empty-state UI renders instead of throwing. This fix has NOT yet been verified end-to-end in the browser.

## Where to resume
Continue the verification workflow:

1. `preview_list` → find the watchlist server (it was running on auto-assigned port, last seen 63654). If not running, `preview_start` with cwd `/Users/nishanksharma/watchlist`.
2. `preview_eval` `window.location.href = '/unlock'` (or reload).
3. Fill `passcode` field with `preview` (matches `.env.local` `APP_PASSCODE=preview`) and submit.
4. Confirm the home page renders the empty state ("Open search ⌘K" hint) — no runtime overlay.
5. `preview_screenshot` the unlocked home.
6. `preview_resize` to mobile width, screenshot.
7. Test theme toggle (dark → light), screenshot.
8. Report results + Vercel deploy steps to user.

Steps 2–5 of the plan's smoke test (Cmd+K → search Dune, mark watched, create lists) need real TMDB + Supabase credentials and can't be exercised locally. Note this in the final report.

## Key files touched
- `lib/supabase.ts` — stub client fallback (most recent edit, unverified)
- `lib/tmdb.ts` — server-only TMDB helpers
- `lib/tmdb-image.ts` — pure URL helpers (split out so client components don't pull `server-only`)
- `lib/actions.ts` — all Server Actions (addTitle, setStatus, setRating, setReview, createList, etc.)
- `proxy.ts` — Next 16 passcode gate (renamed from middleware.ts; function is `proxy`)
- `app/unlock/page.tsx` — uses `await cookies()` and `PageProps<"/unlock">`
- `app/(app)/layout.tsx` — TopNav + CommandPaletteProvider wrapper
- `app/(app)/page.tsx`, `watched/`, `lists/`, `lists/[slug]/`, `title/[id]/`
- `components/` — poster-card, media-grid, backdrop-hero, star-rating, status-pill, command-palette, review-sheet, top-nav, plus copied shadcn ui/
- `app/globals.css` — Tailwind v4 `@theme inline` with HSL triplet tokens, dark-first
- `next.config.ts` — `turbopack.root` set to silence multi-lockfile warning, image remotePatterns for TMDB
- `.env.local` — only `APP_PASSCODE=preview` set; other vars empty (stub kicks in)

## Next 16 gotchas already handled
- `proxy.ts` not `middleware.ts`; export `proxy` not `middleware`
- `params`, `searchParams`, `cookies()`, `headers()` are async — always `await`
- `PageProps<'/route'>` / `LayoutProps<'/route'>` are global helpers; regenerate via `npx next typegen` if route shapes change
- Turbopack is default; multiple lockfiles trigger workspace-root warning

## Known landmines
- `lib/supabase.ts` stub: builder is a thenable that resolves to `{data: [], error: null}`. If new query chains are added (e.g., `.range()`, `.match()`), add them to the stub or it will return `undefined` and break callers.
- Server/client boundary: anything importing `server-only` cannot be imported from a client component. Keep client-safe TMDB helpers in `lib/tmdb-image.ts`.
- `lists/[slug]/page.tsx` casts the joined `titles` relation through `unknown` because Supabase-js types it as `T | T[]`. Don't "fix" the cast — flatMap pattern is intentional.
- `.claude/launch.json` (project-local) sets `"autoPort": true` for watchlist. Don't hardcode 3000; floww also uses 3000.

## Deploy steps to give the user (when verification passes)
1. Push repo to GitHub.
2. Import in Vercel; framework auto-detected as Next.js.
3. Add env vars in Vercel project settings: `TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSCODE`.
4. Run the schema SQL from the plan in the Supabase SQL editor.
5. Get a TMDB v3 API key from https://www.themoviedb.org/settings/api.
6. Deploy. First visit redirects to `/unlock`; enter passcode; cookie persists.

## Out of scope (don't get pulled in)
Multi-user, social, Letterboxd CSV import, PWA, streaming-provider data. These were explicitly deferred in the plan.
