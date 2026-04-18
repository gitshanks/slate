"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "slate-demo-banner-dismissed";

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

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
