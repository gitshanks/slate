"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutGrid, Layers, Plus } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";
import { APP_ROOT } from "@/lib/public-mode";
import { PRIMARY_TAB_TRANSITION } from "@/lib/motion";

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
 * Floating primary dock shared by mobile and desktop. Route navigation lives
 * in one predictable place while the top chrome stays focused on page context
 * and global actions.
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
  const [optimisticTab, setOptimisticTab] = React.useState<string | null>(null);

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
  const visualActiveHref = optimisticTab ?? activeHref;
  const visualActiveIndex = TABS.findIndex(
    (tab) => tab.href === visualActiveHref,
  );
  const isExactPrimaryTab = TABS.some((tab) => pathname === tab.href);

  // Move the dock indicator as soon as client navigation begins instead of
  // waiting for the destination route to finish rendering. Keep a short
  // recovery window for interrupted/failed navigations, while preserving the
  // latest target when several tabs are selected in quick succession.
  React.useEffect(() => {
    if (!optimisticTab) return;
    if (findCurrentTab(pathname) === optimisticTab) {
      setOptimisticTab(null);
      return;
    }

    const recoveryTimer = window.setTimeout(() => {
      setOptimisticTab(null);
    }, 3000);

    return () => window.clearTimeout(recoveryTimer);
  }, [optimisticTab, pathname]);

  // Mobile keeps the dock in the app's grid stack so it cannot be stranded by
  // iOS after search closes. Desktop can safely pin the same compact surface to
  // the viewport because document chrome does not follow the mobile keyboard.
  return (
    <nav
      id="app-bottom-nav"
      className="pointer-events-none relative isolate z-40 w-full shrink-0 self-end bg-transparent text-foreground [grid-area:app-stack] md:fixed md:inset-x-0 md:bottom-4 md:self-auto"
      aria-label="Primary"
      style={{
        // Cosmetic breathing room lives in the dock row below. This owns only
        // the device inset, so top and bottom spacing stay optically equal on
        // browsers without a home indicator as well.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className="relative isolate mx-auto grid h-[76px] w-full max-w-[430px] grid-cols-[minmax(0,1fr)_60px] gap-2.5 py-2"
        style={{
          paddingInlineStart:
            "max(0.75rem, calc(env(safe-area-inset-left) + 0.5rem))",
          paddingInlineEnd:
            "max(0.75rem, calc(env(safe-area-inset-right) + 0.5rem))",
        }}
      >
        <ul
          className="pointer-events-auto relative z-10 grid min-w-0 grid-cols-3 overflow-hidden rounded-full border border-foreground/[0.12] bg-background/[0.58] p-1 ring-1 ring-foreground/[0.05]"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--foreground) / 0.12) 0%, hsl(var(--foreground) / 0.035) 42%, transparent 72%), hsl(var(--background) / 0.58)",
            boxShadow:
              "0 18px 42px -28px rgb(0 0 0 / 0.9), inset 0 1px 0 hsl(var(--foreground) / 0.14), inset 0 -1px 0 hsl(var(--background) / 0.55)",
            WebkitBackdropFilter: "blur(8px) saturate(1.08)",
            backdropFilter: "blur(8px) saturate(1.08)",
          }}
        >
          <li
            aria-hidden
            className="pointer-events-none absolute inset-1 z-0 overflow-hidden rounded-full"
          >
            <span
              className="absolute inset-y-0 left-0 w-1/3 rounded-full border border-primary/20 bg-primary/[0.14] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-150"
              style={{
                opacity: visualActiveIndex === -1 ? 0 : 1,
                transform: `translate3d(${Math.max(visualActiveIndex, 0) * 100}%, 0, 0)`,
              }}
            />
          </li>

          {TABS.map((t) => {
            const active = t.href === visualActiveHref;
            const current = t.href === activeHref;
            const Icon = t.icon;
            return (
              <li key={t.href} className="relative z-10 min-w-0">
                <Link
                  href={t.href}
                  prefetch
                  onNavigate={() => setOptimisticTab(t.href)}
                  transitionTypes={
                    isExactPrimaryTab && pathname !== t.href
                      ? [PRIMARY_TAB_TRANSITION]
                      : undefined
                  }
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative isolate grid h-full touch-manipulation grid-rows-[20px_11px] content-center justify-items-center gap-[5px] overflow-hidden rounded-full px-1 text-[11px] font-medium tracking-tight outline-none transition-[color,transform] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none motion-reduce:scale-100",
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
          className="pointer-events-auto relative z-10 grid h-[60px] w-[60px] touch-manipulation place-items-center overflow-hidden rounded-full border border-foreground/[0.14] bg-background/[0.54] text-primary outline-none transition-[filter,transform] hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.95] motion-reduce:active:scale-100"
          aria-label="Find and add a title"
          aria-haspopup="dialog"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--foreground) / 0.16) 0%, hsl(var(--foreground) / 0.035) 43%, transparent 72%), radial-gradient(circle at 50% 112%, hsl(var(--primary) / 0.38), transparent 68%), hsl(var(--background) / 0.54)",
            boxShadow:
              "0 16px 34px -22px hsl(var(--primary) / 0.75)",
            WebkitBackdropFilter: "blur(8px) saturate(1.08)",
            backdropFilter: "blur(8px) saturate(1.08)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-x-2 top-1 h-4 rounded-full bg-white/[0.08] blur-sm"
          />
          <Plus className="relative h-6 w-6" strokeWidth={2.1} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
