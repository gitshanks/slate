"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LOADED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_INTERVAL_MS = 60_000;

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (LOADED_BUILD_ID === "dev") return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (cancelled) return;
        if (buildId && buildId !== LOADED_BUILD_ID) setStale(true);
      } catch {
        // network blip — try again next tick
      }
    }

    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!stale || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6"
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
