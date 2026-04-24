"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "slate-demo-banner-dismissed";
const DISMISS_EVENT = "slate:demo-banner-dismiss";

function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  return localStorage.getItem(DISMISS_KEY);
}

export function DemoBanner() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, () => "1");
  if (dismissed !== null) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <div className="relative z-50 w-full bg-muted/60 backdrop-blur-sm border-b border-border/60 px-4 py-2 text-center text-xs text-muted-foreground">
      <span>
        You&apos;re browsing the demo — this library is synthetic and your changes stay in your browser.{" "}
        <a
          href="https://github.com/gitshanks/slate"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          View source
        </a>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss demo banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
