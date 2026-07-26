"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Clock, Eye, Check, Layers, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_ROOT } from "@/lib/public-mode";
import { EASE, DUR } from "@/lib/motion";

// Icons mirror AddStatusDropdown's want/watching/watched mapping (Clock /
// Eye / Check) so the same metaphor reads everywhere a title's status is
// surfaced — chip on poster cards, status dropdown, and now the tab bar.
const TABS = [
  { href: APP_ROOT, label: "Watchlist", icon: Clock },
  { href: "/watching", label: "Watching", icon: Eye },
  { href: "/watched", label: "Watched", icon: Check },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/import", label: "Import", icon: Upload },
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
  const [rememberedTab, setRememberedTab] = React.useState<string | null>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const layoutViewportRef = React.useRef<HTMLDivElement>(null);

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

  // iOS can intermittently paint `position: fixed; bottom: 0` against a stale
  // layout viewport while the browser chrome expands/collapses. Track the
  // actual visual viewport and translate the composited nav layer down when
  // that stale viewport would leave it above the device edge. Never translate
  // it upward: a shorter visual viewport is normally the soft keyboard, and
  // retaining that negative offset after search closes strands the nav midway
  // up the screen. The fixed probe avoids relying on window.innerHeight.
  React.useEffect(() => {
    const nav = navRef.current;
    const layoutViewport = layoutViewportRef.current;
    const viewport = window.visualViewport;
    if (!nav || !layoutViewport || !viewport) return;

    let frame = 0;
    const settleTimers = new Set<number>();

    const syncToVisualViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (getComputedStyle(nav).display === "none") return;

        const layoutHeight = layoutViewport.getBoundingClientRect().height;
        const offsetX = viewport.offsetLeft;
        const offsetY = Math.max(
          0,
          viewport.height - layoutHeight + viewport.offsetTop,
        );

        nav.style.setProperty(
          "--bottom-nav-offset-x",
          `${offsetX.toFixed(2)}px`
        );
        nav.style.setProperty(
          "--bottom-nav-offset-y",
          `${offsetY.toFixed(2)}px`
        );
      });
    };

    // WebKit can finish restoring the viewport in several stages after an
    // input blurs. Re-measure across that short settling window so closing
    // search, adding a title, and dismissing the keyboard cannot leave a stale
    // correction on the nav.
    const settleToVisualViewport = () => {
      for (const timer of settleTimers) window.clearTimeout(timer);
      settleTimers.clear();
      syncToVisualViewport();

      for (const delay of [80, 240, 500]) {
        const timer = window.setTimeout(() => {
          settleTimers.delete(timer);
          syncToVisualViewport();
        }, delay);
        settleTimers.add(timer);
      }
    };

    syncToVisualViewport();
    window.addEventListener("resize", syncToVisualViewport);
    window.addEventListener("scroll", syncToVisualViewport, {
      passive: true,
    });
    window.addEventListener("pageshow", settleToVisualViewport);
    window.addEventListener("orientationchange", settleToVisualViewport);
    document.addEventListener("focusin", settleToVisualViewport);
    document.addEventListener("focusout", settleToVisualViewport);
    viewport.addEventListener("resize", syncToVisualViewport);
    viewport.addEventListener("scroll", syncToVisualViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      for (const timer of settleTimers) window.clearTimeout(timer);
      window.removeEventListener("resize", syncToVisualViewport);
      window.removeEventListener("scroll", syncToVisualViewport);
      window.removeEventListener("pageshow", settleToVisualViewport);
      window.removeEventListener("orientationchange", settleToVisualViewport);
      document.removeEventListener("focusin", settleToVisualViewport);
      document.removeEventListener("focusout", settleToVisualViewport);
      viewport.removeEventListener("resize", syncToVisualViewport);
      viewport.removeEventListener("scroll", syncToVisualViewport);
    };
  }, []);

  // If the user is on a tab, the URL wins. Otherwise fall back to the
  // remembered tab so the bar shows their origin.
  const activeHref = findCurrentTab(pathname) ?? rememberedTab;

  return (
    <>
      <div
        ref={layoutViewportRef}
        aria-hidden
        className="pointer-events-none invisible fixed inset-0 md:hidden"
      />
      <nav
        ref={navRef}
        className="bottom-nav-device-fixed fixed inset-x-0 bottom-0 z-40 glass border-t border-border/60 md:hidden"
        aria-label="Primary"
        style={{
          // Lift the inner row above the iOS home indicator AND add a notch
          // of breathing on top of it. Floor at 1.5rem so Android / desktop
          // browsers (no safe-area) still get the same generous gap from
          // the bar's bottom edge to the labels.
          paddingBottom: "max(calc(env(safe-area-inset-bottom) + 0.5rem), 1.5rem)",
        }}
      >
        <ul className="flex items-stretch px-1 pt-3">
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
        </ul>
      </nav>
    </>
  );
}
