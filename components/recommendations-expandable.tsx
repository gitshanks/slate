"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { RailScroller } from "@/components/rail-scroller";
import { TmdbTile } from "@/components/tmdb-tile";
import { cn } from "@/lib/utils";

const RAIL_COUNT = 24;

interface RecommendationsExpandableProps {
  title: string;
  items: TmdbSearchResult[];
  savedTmdbIds?: number[];
}

/**
 * "You might like" section — rail of the top picks plus a "See more"
 * toggle that reveals the remaining recommendations as a grid.
 * All items are delivered from the server in one payload, so expand
 * is instant with no extra fetch.
 */
export function RecommendationsExpandable({
  title,
  items,
  savedTmdbIds,
}: RecommendationsExpandableProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const savedSet = new Set<number>(savedTmdbIds ?? []);
  const railItems = items.slice(0, RAIL_COUNT);
  const gridItems = items.slice(RAIL_COUNT);
  const canExpand = gridItems.length > 0;

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          {title}
        </h2>
        <span className="text-[11px] text-muted-foreground font-mono">
          {items.length} picks
        </span>
      </div>

      <div>
        <RailScroller>
          {railItems.map((item) => (
            <TmdbTile
              key={`${item.media_type}-${item.id}`}
              item={item}
              saved={savedSet.has(item.id)}
            />
          ))}
        </RailScroller>
      </div>

      {expanded && canExpand && (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
          {gridItems.map((item) => (
            <TmdbTile
              key={`${item.media_type}-${item.id}`}
              item={item}
              saved={savedSet.has(item.id)}
              variant="grid"
            />
          ))}
        </div>
      )}

      {canExpand && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {expanded ? "Show less" : `See more (${gridItems.length})`}
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
