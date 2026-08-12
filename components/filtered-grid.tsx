"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { GalleryHorizontal, LayoutGrid } from "lucide-react";
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
  searchQuery?: string;
  compactMobile?: boolean;
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
  searchQuery = "",
  compactMobile = false,
}: FilteredGridProps) {
  const sp = useSearchParams();
  const [expanded, setExpanded] = React.useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);
  const restorePositionOnCollapse = React.useRef(false);
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
  const filteredTitles = filterAndSort(allTitles, status, params);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const titles = normalizedSearchQuery
    ? filteredTitles.filter((title) =>
        `${title.title} ${title.original_title ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSearchQuery),
      )
    : filteredTitles;
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

  React.useLayoutEffect(() => {
    if (expanded || !restorePositionOnCollapse.current) return;

    restorePositionOnCollapse.current = false;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [expanded]);

  const setGridView = React.useCallback(
    (nextExpanded: boolean) => {
      if (nextExpanded === expanded) return;
      restorePositionOnCollapse.current = expanded && !nextExpanded;
      setExpanded(nextExpanded);
    },
    [expanded],
  );

  if (titles.length === 0 && allTitles.length > 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        {normalizedSearchQuery
          ? "No titles match your search."
          : "No titles match the current filters."}
      </p>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label={sectionLabel}
      className="scroll-mt-3 md:scroll-mt-20"
    >
      {canCollapse && (
        <div
          className={cn(
            "relative z-30 -mt-3 mb-4 flex h-10 items-center justify-end",
            expanded && "sticky top-2 md:top-[4.5rem]",
          )}
        >
          <button
            type="button"
            onClick={() => setGridView(!expanded)}
            aria-label={expanded ? "Switch to row view" : "Switch to grid view"}
            aria-controls={disclosureId}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border bg-background/90 text-xs font-medium shadow-[0_12px_32px_-14px_hsl(var(--foreground)/0.55)] backdrop-blur-xl transition-[color,border-color,background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              expanded
                ? "w-9 border-primary/40 px-0 text-primary hover:bg-card sm:w-auto sm:min-w-[5.25rem] sm:px-3"
                : "min-w-[5.25rem] border-border/80 px-3 text-muted-foreground hover:border-primary/30 hover:bg-card hover:text-foreground",
            )}
          >
            {expanded ? (
              <>
                <GalleryHorizontal className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">Row</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Grid
              </>
            )}
          </button>
        </div>
      )}

      <div id={disclosureId}>
        <MediaGrid
          titles={titles}
          readOnly={readOnly}
          titleHrefBase={titleHrefBase}
          horizontal={isCollapsed}
          compactMobile={compactMobile}
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
    </section>
  );
}
