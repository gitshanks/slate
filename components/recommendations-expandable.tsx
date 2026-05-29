"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { TmdbTile } from "@/components/tmdb-tile";
import { cn } from "@/lib/utils";

const COLLAPSED_COUNT = 12;

interface RecommendationsExpandableProps {
  title: string;
  /** Short explanation of how these picks were generated. */
  subtitle?: string;
  items: TmdbSearchResult[];
  savedTmdbIds?: number[];
  /** Teaser mode: show only the first row, no inline expand (a "See all"
   *  link elsewhere takes over). */
  preview?: boolean;
}

/**
 * "You might like" section — a grid of personalised picks that renders a
 * truncated preview by default and expands inline to reveal the rest. No
 * horizontal scroll affordance: the whole list is one continuous grid and
 * "See more" is the only way to read past the preview row. All items are
 * delivered from the server in one payload so expand is instant.
 */
export function RecommendationsExpandable({
  title,
  subtitle,
  items,
  savedTmdbIds,
  preview = false,
}: RecommendationsExpandableProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const savedSet = new Set<number>(savedTmdbIds ?? []);
  const hiddenCount = Math.max(items.length - COLLAPSED_COUNT, 0);
  const canExpand = !preview && hiddenCount > 0;
  const visibleItems = !preview && expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="hidden shrink-0 sm:inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono transition-colors hover:text-foreground"
          >
            {expanded ? "Show less" : `See more (${hiddenCount})`}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10">
        {visibleItems.map((item) => (
          <TmdbTile
            key={`${item.media_type}-${item.id}`}
            item={item}
            saved={savedSet.has(item.id)}
            variant="grid"
          />
        ))}
      </div>

      {canExpand && (
        <div className="mt-6 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {expanded ? "Show less" : `See more (${hiddenCount})`}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      )}
    </section>
  );
}
