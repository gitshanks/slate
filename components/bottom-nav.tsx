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
  const librarySurface = pathname === APP_ROOT;

  // This is an ordinary, non-shrinking row in the mobile app shell. The middle
  // content region scrolls independently, so the bar never uses fixed/sticky
  // positioning and cannot be stranded by iOS after search closes.
  return (
    <nav
      className={cn(
        "relative isolate z-40 w-full shrink-0 border-t md:hidden",
        librarySurface &&
          "dark border-transparent bg-transparent text-white",
        !librarySurface && "glass border-border/60",
      )}
      aria-label="Primary"
      style={{
        // Lift the inner row above the iOS home indicator AND add a notch
        // of breathing on top of it. Floor at 1.5rem so Android / desktop
        // browsers (no safe-area) still get the same generous gap from
        // the bar's bottom edge to the labels.
        paddingBottom: "max(calc(env(safe-area-inset-bottom) + 0.5rem), 1.5rem)",
      }}
    >
      {librarySurface ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,10,9,0.98)_0%,rgba(8,10,9,0.9)_54%,rgba(8,10,9,0.54)_76%,rgba(8,10,9,0)_100%)]" />
          <div
            className="absolute inset-0 backdrop-blur-2xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to top, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
              maskImage:
                "linear-gradient(to top, black 0%, black 48%, rgba(0,0,0,0.72) 68%, transparent 100%)",
            }}
          />
        </div>
      ) : null}

      <ul className="relative flex items-stretch px-1 pt-3">
        {TABS.map((t) => {
          const active = t.href === activeHref;
          const Icon = t.icon;
          return (
            <li key={t.href} className="relative flex-1">
              <Link
                href={t.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium tracking-tight transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Sliding top indicator — one bar shared across tabs, Motion
                      glides it to the active tab. */}
                {active && (
                  <motion.span
                    layoutId="bottomnav-active"
                    transition={{ duration: DUR.base, ease: EASE }}
                    className="absolute -top-3 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                  />
                )}
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-transform",
                    active && "scale-[1.05]",
                  )}
                  aria-hidden
                />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="relative flex-1">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex w-full flex-col items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium tracking-tight text-primary transition-[color,transform] active:scale-[0.97]"
            aria-label="Find and add a title"
          >
            <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_-7px_rgba(173,235,179,0.9)]">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>Add</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
