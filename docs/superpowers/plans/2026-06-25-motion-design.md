# Motion Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add refined, Linear/Vercel-grade motion across the whole app — page-switch entrances, staggered content reveals, and unified micro-interactions — using the `motion` library while keeping the existing View Transitions poster morph.

**Architecture:** A single motion vocabulary in `lib/motion.ts` (easing/durations/variants) drives all animations. `<MotionConfig reducedMotion="user">` at the root makes everything honor `prefers-reduced-motion` automatically. Page entrances come from a client `(app)/template.tsx` keyed on `usePathname()` (enter-only — App Router can't do reliable exit). View Transitions stay scoped to the poster morph; the redundant CSS root crossfade is removed so the two systems don't double-animate. Pages remain Server Components; motion lives in small client wrappers.

**Tech Stack:** Next.js 16.2.3 (App Router), React 19.2.4, `motion` (framer-motion successor, `motion/react`), Tailwind v4, TypeScript.

## Global Constraints

- **Library:** only `motion` may be added. No other animation deps. Import from `motion/react`.
- **Personality:** refined & subtle. Easing `[0.32, 0.72, 0, 1]`; durations 0.15 / 0.22 / 0.32s; rise 6–10px; no spring bounce.
- **Transform/opacity only** for entrances (GPU-composited). The only layout-animated element is the nav `layoutId` indicator (Motion FLIP).
- **Accessibility:** all Motion respects `prefers-reduced-motion` via root `MotionConfig`. Existing reduced-motion CSS stays.
- **Server components stay server components.** `motion/react` is client-only; wrap, don't convert pages.
- **Keep the poster morph.** Do not remove any `view-transition-name` declarations or the `components/view-transition.tsx` wrapper.
- **Verification is visual:** every task ends with `npm run build` (or typecheck) passing and, where visible, a browser screenshot at desktop + mobile via the gstack `browse` tool against `http://localhost:3007` (dev server runs with `NEXT_PUBLIC_DEMO_MODE=1 APP_PASSCODE=`).
- Read `node_modules/next/dist/docs/` before touching Next file conventions (per AGENTS.md).
- Commit after each task. Do not push unless asked.

---

### Task 1: Motion foundation — install `motion`, add tokens, wrap root in MotionConfig

**Files:**
- Modify: `package.json` (+ `motion` dependency)
- Create: `lib/motion.ts`
- Modify: `app/layout.tsx` (wrap children in `<MotionConfig>`)

**Interfaces:**
- Produces: `lib/motion.ts` exporting:
  - `EASE: [number, number, number, number]`
  - `DUR: { fast: number; base: number; slow: number }`
  - `RISE: number`, `STAGGER: number`, `STAGGER_MAX: number`
  - `fadeIn`, `fadeInUp`, `pageEnter`, `staggerContainer` (Motion `Variants`)
  - `staggerChild` (Motion `Variants`) — the per-item variant used inside a `staggerContainer`

- [ ] **Step 1: Install motion**

```bash
npm install motion
```

Expected: `motion` appears in `package.json` dependencies; `package-lock.json` updated.

- [ ] **Step 2: Create `lib/motion.ts`**

```ts
import type { Variants, Transition } from "motion/react";

// Matches the easing the View Transitions already use, so CSS + JS motion feel identical.
export const EASE = [0.32, 0.72, 0, 1] as const;

export const DUR = {
  fast: 0.15, // taps, toggles, hovers
  base: 0.22, // page entrance, content reveals
  slow: 0.32, // hero / detail-page staged reveals
} as const;

export const RISE = 8;
export const STAGGER = 0.03;
export const STAGGER_MAX = 0.18;

const baseTransition: Transition = { duration: DUR.base, ease: EASE };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: baseTransition },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};

// Container that staggers its children in. Cap total ripple via STAGGER_MAX
// at the call site by limiting child count or passing a custom delay.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER, when: "beforeChildren" },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: { opacity: 1, y: 0, transition: baseTransition },
};
```

- [ ] **Step 3: Wrap the root tree in `<MotionConfig reducedMotion="user">`**

In `app/layout.tsx`, import and wrap the existing provider tree. `MotionConfig` is a client component but renders children transparently, so server children still work.

```tsx
import { MotionConfig } from "motion/react";
// ...
// Inside the body, wrap the existing <ThemeProvider>/<AccentProvider> subtree:
<MotionConfig reducedMotion="user">
  {/* existing providers + children unchanged */}
</MotionConfig>
```

Place `MotionConfig` as high as possible (outside ThemeProvider is fine) so every Motion component inherits `reducedMotion="user"`.

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: build succeeds, no type errors. `motion/react` resolves.

- [ ] **Step 5: Smoke-test the app still renders**

Start dev (`NEXT_PUBLIC_DEMO_MODE=1 APP_PASSCODE= PORT=3007 npm run dev`), then with the `browse` tool: `goto http://localhost:3007/`, `console` (no new errors), `screenshot`. App looks identical (no visual change yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/motion.ts app/layout.tsx
git commit -m "Add motion foundation: motion dep, tokens, root MotionConfig"
```

---

### Task 2: Page-switch entrance — `(app)/template.tsx` + remove redundant CSS root crossfade

**Files:**
- Create: `app/(app)/template.tsx`
- Modify: `app/globals.css` (remove only the root-page crossfade VT rules + `slate-vt-fade-*` keyframes; keep poster morph rules)

**Interfaces:**
- Consumes: `pageEnter` from `lib/motion.ts`.
- Produces: a client template that wraps every `(app)` route's content with a keyed entrance animation.

- [ ] **Step 1: Read the existing View Transition CSS**

Read `app/globals.css` around the view-transition block (≈ lines 314–363). Identify (a) the **root crossfade** rules — `::view-transition-old(root)`, `::view-transition-new(root)`, the `slate-vt-fade-out`/`slate-vt-fade-in` keyframes, and any `::view-transition-group(root)` timing — versus (b) the **poster morph** rules (anything tied to a poster `view-transition-name`). Only (a) is removed.

- [ ] **Step 2: Create `app/(app)/template.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { pageEnter } from "@/lib/motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      variants={pageEnter}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
```

Keying on `pathname` guarantees the entrance fires on every route change, including sibling routes under the `(app)` route group where the template may not remount on its own.

- [ ] **Step 3: Remove the redundant root crossfade from `app/globals.css`**

Delete the root-only crossfade rules and the `slate-vt-fade-out` / `slate-vt-fade-in` keyframes identified in Step 1. Leave every poster `view-transition-name` rule and the reduced-motion VT block intact (the reduced-motion block can keep disabling whatever VT remains).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Visual verification**

With `browse` against `http://localhost:3007`:
- `goto /`, then `click` a nav route (e.g. Watching) → content fades+rises in (~220ms), no double-fade flash.
- Open a title detail from a poster → the **poster still morphs** into the hero (View Transitions intact).
- `screenshot` mid-nav if possible; confirm no layout shift.
- Toggle OS reduce-motion (or set `prefers-reduced-motion`): entrance becomes opacity-only/none.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/template.tsx app/globals.css
git commit -m "Add page-switch entrance via (app)/template; drop redundant VT crossfade"
```

---

### Task 3: Staggered content entrances for grids & rails

**Files:**
- Create: `components/motion-grid.tsx` (a reusable client stagger container + item)
- Modify: grid/rail render sites: `app/(app)/page.tsx`, `app/(app)/watching/page.tsx`, `app/(app)/watched/page.tsx`, `app/(app)/lists/page.tsx`, `app/(app)/search/page.tsx`, `app/(app)/discover/page.tsx` (wrap the card collection)

**Interfaces:**
- Consumes: `staggerContainer`, `staggerChild`, `STAGGER_MAX` from `lib/motion.ts`.
- Produces:
  - `<MotionGrid className?>` — client wrapper rendering a `motion.div` with `staggerContainer`, `initial="hidden"`, `animate="visible"`. Caps effective stagger so large grids settle under ~`STAGGER_MAX`+`DUR.base`.
  - `<MotionItem className?>` — `motion.div` using `staggerChild`. Wrap each card/tile.

- [ ] **Step 1: Create `components/motion-grid.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerChild } from "@/lib/motion";

export function MotionGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
```

Note: passing `className` through preserves the existing Tailwind grid/rail layout classes — `MotionGrid` replaces the wrapper `div`'s element, not its classes.

- [ ] **Step 2: Wrap one grid first (the watchlist on `/`)**

In `app/(app)/page.tsx`, replace the outer grid `<div className="<grid classes>">{cards}</div>` with `<MotionGrid className="<grid classes>">` and wrap each card in `<MotionItem>`. Keep all existing classes. Because `page.tsx` is a Server Component, `MotionGrid`/`MotionItem` are imported client components used as children — no `"use client"` needed on the page.

- [ ] **Step 3: Verify the first grid**

`browse`: `goto /`, observe poster cards rise/fade in, staggered, settling quickly. `screenshot` desktop + `viewport 390x844` mobile. Confirm no re-trigger when you change the genre filter (entrance should be a one-time mount effect). If it re-fires on filter, scope the container so its `key`/mount is stable across filter changes (filter updates children in place).

- [ ] **Step 4: Apply to remaining grids/rails**

Repeat the wrap for `watching`, `watched`, `lists`, `search`, `discover` card collections. For horizontal rails, wrapping the rail track in `MotionGrid` and tiles in `MotionItem` gives a left-to-right stagger.

- [ ] **Step 5: Build + verify each route**

Run: `npm run build` (success). `browse` each route, confirm entrance + no layout shift on desktop and mobile.

- [ ] **Step 6: Commit**

```bash
git add components/motion-grid.tsx app/(app)/page.tsx app/(app)/watching/page.tsx app/(app)/watched/page.tsx app/(app)/lists/page.tsx app/(app)/search/page.tsx app/(app)/discover/page.tsx
git commit -m "Stagger content entrances across grids and rails"
```

---

### Task 4: Sliding active-route indicator in top-nav and bottom-nav

**Files:**
- Modify: `components/top-nav.tsx` (active route pill → shared `layoutId` indicator)
- Modify: `components/bottom-nav.tsx` (active tab indicator)

**Interfaces:**
- Consumes: `EASE`, `DUR` from `lib/motion.ts`.
- Produces: no new exports. The active highlight becomes a `motion.span` with `layoutId="nav-active"` (top) / `layoutId="bottomnav-active"` (bottom) rendered only under the active item, so Motion FLIP-slides it between items.

- [ ] **Step 1: Convert top-nav active pill**

In `components/top-nav.tsx`, these are already client components (they use `usePathname`). For each route pill, when active, render a positioned `motion.span` behind the label:

```tsx
import { motion } from "motion/react";
import { EASE, DUR } from "@/lib/motion";
// ...
{isActive && (
  <motion.span
    layoutId="nav-active"
    className="absolute inset-0 -z-10 rounded-[inherit] bg-accent"
    transition={{ layout: { duration: DUR.base, ease: EASE } }}
  />
)}
```

The pill's container needs `relative` and the label sits above (`z-10` or default stacking). Keep the existing `bg-accent` look but move the fill into the shared element so only one exists at a time and it slides.

- [ ] **Step 2: Verify top-nav slide**

`browse` desktop: click between Watchlist/Watching/Watched/Lists/Import — the highlight slides smoothly between pills instead of snapping. `screenshot`.

- [ ] **Step 3: Convert bottom-nav active indicator**

In `components/bottom-nav.tsx`, apply the same shared-element pattern with `layoutId="bottomnav-active"` (a small underline/dot or the existing active treatment). Keep it subtle on touch; keep the existing `scale-[1.05]` icon cue.

- [ ] **Step 4: Verify bottom-nav (mobile)**

`browse`: `viewport 390x844`, `goto /`, tap tabs — indicator slides. `screenshot`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add components/top-nav.tsx components/bottom-nav.tsx
git commit -m "Slide the active-route indicator in top and bottom nav"
```

---

### Task 5: Tap + hover polish on poster cards and tiles

**Files:**
- Modify: `components/poster-card.tsx`
- Modify: `components/tmdb-tile.tsx`

**Interfaces:**
- Consumes: `EASE`, `DUR` from `lib/motion.ts`.
- Produces: no new exports. Cards gain a `whileTap` press; existing hover lift retimed to the token easing.

- [ ] **Step 1: Add press feedback without breaking the poster morph**

The poster image carries a `view-transition-name` for the morph. Do **not** wrap that image in a `motion` component that changes its transform during navigation (it fights the morph). Instead, apply `whileTap` to the **card container** (the link/article), not the morphing image:

```tsx
import { motion } from "motion/react";
import { EASE, DUR } from "@/lib/motion";
// container becomes a motion element:
<motion.article
  whileTap={{ scale: 0.97 }}
  transition={{ duration: DUR.fast, ease: EASE }}
  className="<existing classes>"
>
```

Keep the existing CSS hover lift (`-translate-y-1`, shadow) — it's already gated to pointer devices via the `hoverable` variant. Only ensure its duration reads as `DUR.fast`/`DUR.base` (adjust the Tailwind `duration-*` if needed for consistency).

- [ ] **Step 2: Apply the same to `tmdb-tile.tsx`**

Mirror Step 1 on the tile container.

- [ ] **Step 3: Verify**

`browse`: `goto /`, click-and-hold a card (or check `whileTap` via a quick interaction), confirm subtle press. Open a detail page → poster morph still intact (regression check). `screenshot`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add components/poster-card.tsx components/tmdb-tile.tsx
git commit -m "Add tap feedback to cards; unify hover timing"
```

---

### Task 6: Command palette entrance + result stagger

**Files:**
- Modify: `components/command-palette.tsx`

**Interfaces:**
- Consumes: `EASE`, `DUR`, `staggerContainer`, `staggerChild` from `lib/motion.ts`.
- Produces: no new exports.

- [ ] **Step 1: Animate the dialog content in**

Wrap the palette's content surface in a `motion.div` that scales+fades on open:

```tsx
import { motion } from "motion/react";
import { EASE, DUR, staggerContainer, staggerChild } from "@/lib/motion";
// ...
<motion.div
  initial={{ opacity: 0, scale: 0.98 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: DUR.base, ease: EASE }}
>
```

If the palette uses a Radix/shadcn `Dialog`, mount this inside `DialogContent` (don't fight Radix's own mount; animate the inner surface). Keep focus management intact.

- [ ] **Step 2: Stagger the result rows**

Wrap the results list in `staggerContainer` and each row in `staggerChild` (reuse `MotionGrid`/`MotionItem` from Task 3 if shapes match, else inline `motion.div`s). Cap to the visible window so long result sets don't ripple.

- [ ] **Step 3: Verify**

`browse`: `goto /`, trigger the palette (`press Meta+k` or click the search button), confirm it scales/fades in and results stagger. Type a query; confirm typing stays responsive (no stagger thrash on each keystroke — stagger only on first results render or debounce). `screenshot`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add components/command-palette.tsx
git commit -m "Animate command palette entrance and result stagger"
```

---

### Task 7: Staged reveal on detail pages

**Files:**
- Create: `components/motion-reveal.tsx` (a small client wrapper for an ordered reveal)
- Modify: `app/(app)/title/[id]/page.tsx`
- Modify: `app/(app)/discover/[type]/[tmdbId]/page.tsx`

**Interfaces:**
- Consumes: `EASE`, `DUR`, `RISE` from `lib/motion.ts`.
- Produces:
  - `<MotionReveal delay? className>` — `motion.div` with `initial={{opacity:0, y:RISE}} animate={{opacity:1, y:0}} transition={{duration: DUR.slow, ease: EASE, delay}}`. Used to sequence backdrop → poster → metadata → rails.

- [ ] **Step 1: Create `components/motion-reveal.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { EASE, DUR, RISE } from "@/lib/motion";

export function MotionReveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: RISE }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Sequence the title detail page**

In `app/(app)/title/[id]/page.tsx`, wrap the major blocks in `MotionReveal` with increasing `delay` (e.g. backdrop `0`, poster `DUR.fast`, metadata `DUR.fast*2`, rails `DUR.fast*3`). Do **not** wrap the morphing hero poster image itself (regression with the View Transition) — wrap surrounding metadata, not the poster element that carries `view-transition-name`.

- [ ] **Step 3: Sequence the discover detail page**

Apply the same to `app/(app)/discover/[type]/[tmdbId]/page.tsx`.

- [ ] **Step 4: Verify + mobile guard**

`browse`: open a title from a poster → poster morphs in, then metadata/rails stage in behind it. Confirm on `viewport 390x844` the staging is light (no long hero motion on touch). `screenshot` both.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add components/motion-reveal.tsx app/(app)/title/[id]/page.tsx app/(app)/discover/[type]/[tmdbId]/page.tsx
git commit -m "Stage detail-page reveals (backdrop -> poster -> meta -> rails)"
```

---

### Task 8: Performance & accessibility pass

**Files:**
- Modify: any of the above as needed based on findings (no new files expected)

**Interfaces:** none.

- [ ] **Step 1: Reduced-motion audit**

With `prefers-reduced-motion: reduce` set, `browse` every animated surface (`/`, a list route, a detail page, the palette). Confirm: no transforms/slides, content appears (opacity-only or instant). `MotionConfig reducedMotion="user"` should handle this globally — fix any animation that ignored it (e.g. raw CSS).

- [ ] **Step 2: 60fps / no-CLS check**

`browse`: navigate between routes and open details; confirm no layout shift (CLS) from entrances and no jank. Spot-check `console` for warnings. If any entrance animates a layout property, switch it to transform/opacity.

- [ ] **Step 3: Mobile pass**

`viewport 390x844`: re-walk the key flows. Confirm detail/hero motion stays minimal on touch and nothing overflows.

- [ ] **Step 4: Full production build**

Run: `npm run build`
Expected: success, no type errors, reasonable bundle (note the `motion` size delta is acceptable per the locked decision).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "Motion polish: reduced-motion, CLS, and mobile pass"
```

---

## Self-Review

**Spec coverage:**
- Foundation (A) → Task 1. Page transitions (B) → Task 2. Content entrances (C) → Task 3 (grids/rails) + Task 7 (detail staged reveal). Micro-interactions (D) → Task 4 (nav), Task 5 (cards), Task 6 (palette). Performance & a11y (E) → Task 8. View Transitions coexistence decision → Task 2 Step 3 + regression checks in Tasks 5 & 7. All spec sections mapped.

**Placeholder scan:** No TBD/TODO. Each code step shows concrete code. Verification steps name exact `browse` commands and routes.

**Type consistency:** `lib/motion.ts` exports (`EASE`, `DUR`, `RISE`, `STAGGER`, `STAGGER_MAX`, `fadeIn`, `fadeInUp`, `pageEnter`, `staggerContainer`, `staggerChild`) are referenced with the same names in Tasks 2–7. `MotionGrid`/`MotionItem` (Task 3) and `MotionReveal` (Task 7) signatures match their consumers.

**Open note for the implementer:** confirm `motion` resolves the `motion/react` entry on install (v11+/v12). If an older resolution surfaces `framer-motion`-style imports, adjust the import path — the API used here (`motion`, `MotionConfig`, `usePathname`-keyed entrance, `layoutId`, `whileTap`, `variants`) is stable across recent versions.
