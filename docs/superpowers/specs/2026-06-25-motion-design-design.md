# Motion design — "smooth as butter"

**Date:** 2026-06-25
**Status:** Approved (design), pending implementation plan
**Goal:** Make the whole app feel like it was choreographed by a pro motion designer — refined, subtle, Linear/Vercel-grade motion across page switches, content entrances, and micro-interactions.

## Decisions (locked)

- **Library:** `motion` (the framer-motion successor; `motion/react`). React 19 / Next 16 compatible. No other animation deps.
- **Personality:** Refined & subtle. Fast, short distances, no bounce. Motion you feel more than see.
- **Scope:** Everything — page transitions + content entrances + micro-interactions.
- **View Transitions coexistence:** **Keep** the poster shared-element morph (grid → detail hero) that already runs via the View Transitions API. Motion owns content entrance + micro-interactions; View Transitions owns only the poster morph. Disable the now-redundant CSS root-page crossfade so the two systems don't double-animate.

## Motion vocabulary (`lib/motion.ts`)

A single source of truth so nothing is ad-hoc. Mirrors the easing the View Transitions already use, so CSS and JS motion feel identical.

```
EASE        = [0.32, 0.72, 0, 1]   // matches existing --vt easing
DUR.fast    = 0.15                  // taps, toggles, hovers
DUR.base    = 0.22                  // page entrance, content reveals
DUR.slow    = 0.32                  // hero / detail-page staged reveals
RISE        = 8                     // px of upward travel on entrances (6–10)
STAGGER     = 0.03                  // 30ms between staggered children
STAGGER_MAX = 0.18                  // cap so large grids don't ripple for seconds
```

Exported variants (reused everywhere):
- `fadeIn` — opacity only.
- `fadeInUp` — opacity + `y: RISE → 0`.
- `staggerContainer` — `staggerChildren: STAGGER`, capped via `delayChildren`/count guard.
- `pageEnter` — opacity + `y: RISE → 0` at `DUR.base`.

All distances are transform/opacity only (GPU-composited).

## A. Foundation

- Install `motion`.
- Root layout (`app/layout.tsx`): wrap the tree in `<MotionConfig reducedMotion="user">`. This makes **every** Motion animation respect `prefers-reduced-motion` automatically — reduced-motion users get opacity-only / no transform, no per-component branching.
- `lib/motion.ts` holds the tokens + variants above.

## B. Page transitions (`app/(app)/template.tsx`)

- New **client** `template.tsx` under `(app)`. Wrap `children` in a `motion.div` using `pageEnter`, **keyed by `usePathname()`** so the entrance fires on every route change — including sibling routes at the same segment level, where a route-group template may not remount on its own.
- **Enter-only** (no `AnimatePresence` exit): App Router unmounts old content immediately on navigation, so reliable exit animation isn't available without fragile machinery. A clean, fast enter read is the Linear/Vercel feel anyway.
- Disable the CSS root-page crossfade in `app/globals.css` (the `::view-transition-old(root)/new(root)` + `slate-vt-fade-*` keyframes path) so it doesn't stack with the Motion entrance. Keep all `view-transition-name` declarations on poster images and the poster morph group intact.

## C. Content entrances

- **Grids & rails:** wrap the card collections (watchlist grid, rails, lists grid, search/discover results) in a `staggerContainer`; each poster card / tile is a `fadeInUp` child. Stagger capped (`STAGGER_MAX`) so a 50-item grid settles in well under a second. First paint only — not on every re-filter (guard with a mount flag or layout animation, see Risks).
- **Detail pages** (`/title/[id]`, `/discover/[type]/[tmdbId]`): light staged reveal in order backdrop → poster → metadata block → cast/recommendation rails, each offset by ~`DUR.fast`. Uses `DUR.slow` for the hero.

## D. Micro-interactions

- **Top-nav active pill:** convert the active-route highlight to a shared `layoutId` element so it *slides* between Watchlist / Watching / Watched / Lists / Import instead of snapping. `layout` transition uses `EASE` + `DUR.base`.
- **Bottom-nav (mobile):** active icon uses the same shared-indicator treatment; keep it light on touch.
- **Buttons & cards:** `whileTap={{ scale: 0.97 }}`; unify existing hover lift to `EASE`/`DUR.fast`. Applied via a small set of motion-wrapped primitives, not sprinkled per-call-site.
- **Command palette (⌘K):** dialog scales+fades in (`0.98 → 1`, `DUR.base`); result rows stagger with `staggerContainer`.
- **Theme / accent toggles:** settle to `DUR.fast` token timing (no layout thrash; theme swap itself stays instant via `disableTransitionOnChange`).

## E. Performance & accessibility

- Transform/opacity only; no animating layout-affecting properties except the nav `layoutId` indicator (which Motion handles on the compositor via FLIP).
- Staggers capped; detail-page hero motion suppressed on touch / small screens.
- `prefers-reduced-motion` honored globally via `MotionConfig reducedMotion="user"`; existing reduced-motion CSS for hero poster walls and remaining View Transition stays.
- Verify 60fps and no CLS via the running app (browse screenshots / responsive) before finishing.

## Files in scope (~15–18)

- `package.json` (+ `motion`)
- `lib/motion.ts` (new — tokens + variants)
- `app/layout.tsx` (`MotionConfig`)
- `app/(app)/template.tsx` (new — page entrance)
- `app/globals.css` (disable redundant root crossfade only)
- `components/top-nav.tsx`, `components/bottom-nav.tsx` (sliding indicator)
- `components/poster-card.tsx`, `components/tmdb-tile.tsx` (entrance child + tap)
- Grid/rail containers on: `app/(app)/page.tsx`, `watching/`, `watched/`, `lists/`, `search/`, `discover/` (stagger container)
- `components/command-palette.tsx` (dialog + results)
- Detail pages: `app/(app)/title/[id]/page.tsx`, `app/(app)/discover/[type]/[tmdbId]/page.tsx` (staged reveal)
- A motion-wrapped button/card primitive as needed under `components/`

## Risks & mitigations

- **Stagger re-firing on filter/sort:** entrance should run on first mount, not every client re-render. Mitigate by scoping the stagger container to mount (key by route, not by filter state) and/or `initial={false}` where content updates in place.
- **VT + Motion double-fade:** mitigated by disabling the CSS root crossfade (B) and keeping View Transitions scoped to the poster morph only.
- **Server vs client components:** `motion/react` is client-only. Pages stay Server Components; motion lives in small client wrappers (template, card, nav, palette) — no page needs to become a client component wholesale.
- **iOS Safari jank:** keep hero/detail motion minimal on touch, matching the existing View Transition mobile strategy.

## Out of scope

- No new animation library beyond `motion`.
- No redesign of layouts, colors, or copy.
- No route restructuring.
