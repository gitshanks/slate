"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LOADED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
// Slightly tighter than the original 60s. The cost of a JSON ping is
// negligible compared to the user staring at a stale UI.
const POLL_INTERVAL_MS = 45_000;

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Hoisted so the effect below can call it from multiple event handlers.
  const check = useCallback(async () => {
    try {
      // Cache-busting query param defeats any intermediate CDN that
      // ignores the no-store header (rare but possible). Headers also
      // belt-and-suspenders disable browser cache.
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (!res.ok) return;
      const { buildId } = (await res.json()) as { buildId?: string };
      if (buildId && buildId !== LOADED_BUILD_ID) setStale(true);
    } catch {
      // Network blip — try again next tick.
    }
  }, []);

  useEffect(() => {
    if (LOADED_BUILD_ID === "dev") return;

    // Initial check + steady polling.
    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);

    // Re-check on every "user came back to the page" signal we can find:
    //   - visibilitychange: tab focus on desktop
    //   - pageshow w/ persisted: page restored from bfcache (Safari, FF)
    //   - focus: window regained focus
    //   - online: network reconnected after a flap
    // iOS PWA tabs in particular get suspended aggressively, so the more
    // wake-up signals we listen for, the more likely we catch an update
    // the moment the user returns.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [check]);

  if (!stale || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom)+7rem)] md:bottom-6"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-popover/95 py-1.5 pl-4 pr-1.5 shadow-lg shadow-black/10 ring-1 ring-foreground/5 backdrop-blur">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <p className="text-sm text-foreground">
          A new version of slate is available.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
