"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LOADED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const IS_HOSTED = process.env.NEXT_PUBLIC_SLATE_HOSTED === "1";

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Hoisted so the effect below can call it from multiple event handlers.
  const check = useCallback(async () => {
    try {
      // /api/version is now a build-time static file served from the
      // CDN edge — the browser handles freshness via its own cache
      // semantics, and the response is the same JSON for the lifetime
      // of the deploy. No cache-busting needed.
      const res = await fetch("/api/version");
      if (!res.ok) return;
      const { buildId } = (await res.json()) as { buildId?: string };
      if (buildId && buildId !== LOADED_BUILD_ID) setStale(true);
    } catch {
      // Network blip — the next user-activity event will retry.
    }
  }, []);

  useEffect(() => {
    // Vercel deployments atomically serve one build and normal navigations
    // pick up the newest client bundle. Keep the stale-tab helper for
    // self-hosted installs, but do not make slate.nishh.dev pay for a version
    // request on mount and every overlapping focus/visibility/pageshow event.
    if (LOADED_BUILD_ID === "dev" || IS_DEMO || IS_HOSTED) return;

    // No timer — we only check on user-activity signals. A user who keeps
    // the tab open forever and never leaves it won't see the banner until
    // they switch tabs / focus the window / come back online / bfcache-
    // restores the page, which covers every realistic "I'm back" moment.
    // Dropping the 45s interval is the biggest reduction in function /
    // edge-request load by an order of magnitude.
    const initialCheck = window.setTimeout(check, 0);

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
      window.clearTimeout(initialCheck);
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
