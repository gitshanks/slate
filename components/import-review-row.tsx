"use client";

import * as React from "react";
import { Check, AlertTriangle, Film, Tv } from "lucide-react";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb-image";
import type { ReviewRow } from "@/lib/import-pipeline";

interface ImportReviewRowProps {
  row: ReviewRow;
  checked: boolean;
  onToggle: (key: string) => void;
}

/**
 * One row in the import-review table. Presentational — the widget owns
 * selection state and hands us `checked` + `onToggle`. Memoised so editing
 * another row doesn't re-render every row in a 500-row import.
 */
function ImportReviewRowImpl({ row, checked, onToggle }: ImportReviewRowProps) {
  const hasMatch = row.tmdbId != null && row.mediaType != null;
  // Stable handler that only depends on the row key. The parent passes a
  // stable `onToggle` reference so this component's memo stays effective.
  const handleToggle = React.useCallback(() => onToggle(row.key), [row.key, onToggle]);

  return (
    <li
      className={`group flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 transition-colors ${
        hasMatch
          ? "hover:bg-card/70"
          : "border-amber-500/30 bg-amber-500/[0.04]"
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={!hasMatch}
        onClick={handleToggle}
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        } ${!hasMatch ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      >
        {checked && <Check className="h-3 w-3" />}
      </button>

      {/* Poster thumb */}
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted/60">
        {row.posterPath ? (
          <Image
            src={posterUrl(row.posterPath, "w92") ?? ""}
            alt=""
            width={40}
            height={60}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
            {hasMatch ? (
              row.mediaType === "tv" ? (
                <Tv className="h-4 w-4" />
              ) : (
                <Film className="h-4 w-4" />
              )
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        {hasMatch ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-sm font-medium">{row.title}</p>
              {row.matchYear != null && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.matchYear}
                </span>
              )}
              <span className="shrink-0 rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {row.mediaType}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground/80">
              {row.isEpisode && "Collapsed from episode · "}
              {row.sourceText}
              {row.sourceDate && (
                <span className="ml-1 text-muted-foreground/60">
                  · {formatDate(row.sourceDate)}
                </span>
              )}
            </p>
            {row.approximate && row.approxQuery && (
              <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                Approximate — matched on “{row.approxQuery}”
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-sm font-medium text-amber-700 dark:text-amber-400">
                No match
              </p>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">
                skipped
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground/80">
              {row.sourceText}
            </p>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Render dates like "Mar 12, 2024" from ISO-ish source. Returns the raw
 * string unchanged if we can't parse it — the date column on the source
 * CSV isn't our problem to guarantee.
 */
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ImportReviewRow = React.memo(ImportReviewRowImpl);
