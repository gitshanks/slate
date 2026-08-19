"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Compass, LayoutGrid, Layers, Plus } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";
import { APP_ROOT } from "@/lib/public-mode";
import { EASE, DUR } from "@/lib/motion";

// Status now lives in the Library's pinned collection filter. The bottom bar
// is reserved for primary destinations, so every major app capability stays
// reachable without leaving Shelf or Space in an ambiguous state.
const TABS = [
  { href: APP_ROOT, label: "Library", icon: LayoutGrid },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/lists", label: "Lists", icon: Layers },
] as const;

const STORAGE_KEY = "slate:lastBottomNavTab";

function matchesTab(pathname: string, href: string): boolean {
  return href === APP_ROOT ? pathname === APP_ROOT : pathname.startsWith(href);
}

function findCurrentTab(pathname: string): string | null {
  const tab = TABS.find((t) => matchesTab(pathname, t.href));
  return tab?.href ?? null;
}

/**
 * Mobile-only bottom tab bar. Native-app convention: route nav lives at
 * the thumb-reachable bottom of the screen, the top header keeps just the
 * logo + actions. Hidden on md+ where the desktop top-nav already shows
 * the full pill row.
 *
 * Persists the last visited primary tab in sessionStorage so detail
 * routes (e.g. /title/:id, /person/:id) that aren't a tab themselves
 * still highlight the tab the user came from — the user keeps a sense
 * of "where am I" instead of seeing every tab go inactive.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { open: openCommandPalette } = useCommandPalette();
  const [rememberedTab, setRememberedTab] = React.useState<string | null>(null);

  // Hydrate from sessionStorage on mount so a hard reload on a detail
  // route still highlights the last tab from the previous session.
  React.useEffect(() => {
    setRememberedTab(sessionStorage.getItem(STORAGE_KEY));
  }, []);

  // Whenever we land on an actual tab route, store it. Detail routes
  // pass through unchanged so the previously-stored value sticks.
  React.useEffect(() => {
    const onTab = findCurrentTab(pathname);
    if (onTab) {
      sessionStorage.setItem(STORAGE_KEY, onTab);
      setRememberedTab(onTab);
    }
  }, [pathname]);

  // If the user is on a tab, the URL wins. Otherwise fall back to the
  // remembered tab so the bar shows their origin.
  const menuOnlySurface = ["/profile", "/import", "/share"].some((href) =>
    pathname.startsWith(href),
  );
  const activeHref =
    findCurrentTab(pathname) ?? (menuOnlySurface ? null : rememberedTab);
  // This is an ordinary, non-shrinking row in the mobile app shell. The middle
  // content region scrolls independently, so the bar never uses fixed/sticky
  // positioning and cannot be stranded by iOS after search closes.
  return (
    <nav
      className="relative isolate z-40 w-full shrink-0 bg-transparent text-foreground md:hidden"
      aria-label="Primary"
      style={{
        // Cosmetic breathing room lives in the dock row below. This owns only
        // the device inset, so top and bottom spacing stay optically equal on
        // browsers without a home indicator as well.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, hsl(var(--background) / 1) 0%, hsl(var(--background) / 0.94) 48%, hsl(var(--background) / 0.62) 72%, hsl(var(--background) / 0) 100%)",
          }}
        />
      </div>

      <div
        className="mx-auto grid h-[76px] w-full max-w-[430px] grid-cols-[minmax(0,1fr)_60px] gap-2.5 py-2"
        style={{
          paddingInlineStart:
            "max(0.75rem, calc(env(safe-area-inset-left) + 0.5rem))",
          paddingInlineEnd:
            "max(0.75rem, calc(env(safe-area-inset-right) + 0.5rem))",
        }}
      >
        <ul
          className="relative grid min-w-0 grid-cols-3 rounded-full border border-foreground/[0.1] bg-background/[0.78] p-1 ring-1 ring-foreground/[0.04]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--foreground) / 0.09) 0%, hsl(var(--foreground) / 0.025) 42%, transparent 72%), hsl(var(--background) / 0.78)",
            boxShadow:
              "0 18px 42px -28px rgb(0 0 0 / 0.9), inset 0 1px 0 hsl(var(--foreground) / 0.14), inset 0 -1px 0 hsl(var(--background) / 0.55)",
          }}
        >
          {TABS.map((t) => {
            const active = t.href === activeHref;
            const Icon = t.icon;
            return (
              <li key={t.href} className="relative min-w-0">
                <Link
                  href={t.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative isolate grid h-full touch-manipulation grid-rows-[20px_11px] content-center justify-items-center gap-[5px] overflow-hidden rounded-full px-1 text-[11px] font-medium tracking-tight outline-none transition-[color,transform] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:scale-[0.97]",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="bottomnav-active"
                      initial={false}
                      transition={{ duration: DUR.base, ease: EASE }}
                      className="absolute inset-0 -z-10 rounded-full border border-primary/20 bg-primary/[0.14]"
                    />
                  ) : null}
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      active && "scale-[1.04]",
                    )}
                    aria-hidden
                  />
                  <span className="max-w-full truncate leading-[11px]">
                    {t.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="relative grid h-[60px] w-[60px] touch-manipulation place-items-center overflow-hidden rounded-full border border-primary/55 bg-primary text-primary-foreground outline-none transition-[filter,transform] hover:brightness-[1.04] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.95]"
          aria-label="Find and add a title"
          aria-haspopup="dialog"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--foreground) / 0.18) 0%, transparent 42%), hsl(var(--primary) / 0.88)",
            boxShadow:
              "0 16px 34px -18px hsl(var(--primary) / 0.82), inset 0 1px 0 hsl(var(--foreground) / 0.28), inset 0 -1px 0 hsl(var(--background) / 0.2)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-x-2 top-1 h-4 rounded-full bg-white/10 blur-sm"
          />
          <Plus className="relative h-6 w-6" strokeWidth={2.1} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
