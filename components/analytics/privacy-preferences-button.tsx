"use client";

import { SlidersHorizontal } from "lucide-react";
import { analyticsConfigured, openAnalyticsPreferences } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function PrivacyPreferencesButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (!analyticsConfigured()) return null;

  return (
    <button
      type="button"
      onClick={openAnalyticsPreferences}
      className={cn(
        "inline-flex items-center gap-2 transition-colors",
        compact
          ? "rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          : "text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
      data-analytics-ignore
    >
      {compact ? <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> : null}
      Privacy choices
    </button>
  );
}
