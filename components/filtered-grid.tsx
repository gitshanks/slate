"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { MediaGrid } from "@/components/media-grid";
import { filterAndSort } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";
import type { TitleRow, TitleStatus } from "@/lib/types";

interface FilteredGridProps {
  allTitles: TitleRow[];
  status: Exclude<TitleStatus, "dropped">;
  readOnly?: boolean;
  titleHrefBase?: string;
  collapsible?: boolean;
}

function subscribeToViewport(onChange: () => void) {
  window.addEventListener("resize", onChange, { passive: true });
  return () => window.removeEventListener("resize", onChange);
}

/** One complete poster row at each of Slate's grid breakpoints. */
function getCollapsedCount() {
  const width = window.innerWidth;
  if (width >= 2500) return 10;
  if (width >= 2250) return 9;
  if (width >= 2000) return 8;
  if (width >= 1750) return 7;
  if (width >= 1536) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

/**
 * Client component — reads URL search params and filters/sorts the full title
 * list in memory. Filter changes are instant: no server roundtrip, no skeleton.
 */
export function FilteredGrid({
  allTitles,
  status,
  readOnly = false,
  titleHrefBase,
  collapsible = false,
}: FilteredGridProps) {
  const sp = useSearchParams();
  const [expanded, setExpanded] = React.useState(false);
  const disclosureId = React.useId();
  const collapsedCount = React.useSyncExternalStore(
    subscribeToViewport,
    getCollapsedCount,
    () => 2,
  );
  const params = {
    type: sp.get("type") ?? undefined,
    genre: sp.get("genre") ?? undefined,
    year: sp.get("year") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    sentiment: sp.get("sentiment") ?? undefined,
  };
  const titles = filterAndSort(allTitles, status, params);
  const customOrderIds = filterAndSort(allTitles, status, {}).map(
    (title) => title.id
  );
  const canCollapse = collapsible && titles.length > collapsedCount;
  const isCollapsed = canCollapse && !expanded;
  const sectionLabel =
    status === "want"
      ? "Watchlist titles"
      : status === "watching"
        ? "Titles being watched"
        : "Watched titles";

  if (titles.length === 0 && allTitles.length > 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        No titles match the current filters.
      </p>
    );
  }

  return (
    <section aria-label={sectionLabel}>
      <div id={disclosureId}>
        <MediaGrid
          titles={titles}
          readOnly={readOnly}
          titleHrefBase={titleHrefBase}
          visibleCount={isCollapsed ? collapsedCount : undefined}
          reorderContext={
            readOnly || params.sort
              ? undefined
              : {
                  kind: "status",
                  status,
                  allTitleIds: customOrderIds,
                }
          }
        />
      </div>

      {canCollapse && (
        <div className="relative mt-6 flex items-center gap-3 sm:mt-8">
          <span className="h-px flex-1 bg-border/70" aria-hidden />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={disclosureId}
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 text-sm font-medium text-muted-foreground shadow-[0_10px_30px_-20px_hsl(var(--foreground)/0.45)] backdrop-blur-md transition-[color,border-color,background-color,transform] duration-200 hover:border-primary/40 hover:bg-card hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span>
              {expanded ? "Collapse watchlist" : `Show all ${titles.length} titles`}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          <span className="h-px flex-1 bg-border/70" aria-hidden />
        </div>
      )}
    </section>
  );
}
