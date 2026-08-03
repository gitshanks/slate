"use client";

import * as React from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Film, Tv, LayoutGrid, ChevronDown, X, Heart, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedFilter } from "@/components/segmented-filter";

export interface FilterBarProps {
  /** Distinct genres found in the current result set. */
  genres: { id: number; name: string }[];
  /** Whether to show the "Newest release" sort option (hide if all items lack dates). */
  showYearSort?: boolean;
  /** Whether to show the sentiment (loved/liked/disliked) filter. */
  showSentiment?: boolean;
  /** Label for the chronological sort on this page. */
  recentSortLabel?: string;
}

const TYPE_OPTIONS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "movie", label: "Films", icon: Film },
  { value: "tv", label: "Series", icon: Tv },
] as const;

const YEAR_OPTIONS = [
  { value: "", label: "Any year" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "older", label: "Older" },
] as const;

const SENTIMENT_OPTIONS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "loved", label: "Loved", icon: Heart },
  { value: "liked", label: "Liked", icon: ThumbsUp },
  { value: "disliked", label: "Disliked", icon: ThumbsDown },
] as const;

export function FilterBar({
  genres,
  showYearSort = true,
  showSentiment = false,
  recentSortLabel = "Recently added",
}: FilterBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "";
  const currentGenre = searchParams.get("genre") ?? "";
  const currentYear = searchParams.get("year") ?? "";
  const currentSort = searchParams.get("sort") ?? "";
  const currentSentiment = searchParams.get("sentiment") ?? "";

  const activeGenre = genres.find((g) => String(g.id) === currentGenre);

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${pathname}?${qs}` : pathname
      );
    },
    [pathname, searchParams]
  );

  const clearFilters = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["type", "genre", "year", "sort", "sentiment"]) {
      params.delete(key);
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${pathname}?${qs}` : pathname
    );
  }, [pathname, searchParams]);

  const hasAny = currentType || currentGenre || currentYear || currentSort || currentSentiment;

  const sortOptions = React.useMemo(() => {
    const options = [
      { value: "", label: "Your order" },
      { value: "recent", label: recentSortLabel },
      { value: "rating", label: "Highest rated" },
      { value: "year", label: "Newest release" },
    ];
    return showYearSort
      ? options
      : options.filter((option) => option.value !== "year");
  }, [recentSortLabel, showYearSort]);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {/* Type segmented */}
      <SegmentedFilter
        id="library-type-filter"
        options={TYPE_OPTIONS}
        value={currentType}
        onValueChange={(value) => setParam("type", value)}
      />

      {/* Sentiment segmented — only on watched page */}
      {showSentiment && (
        <SegmentedFilter
          id="library-sentiment-filter"
          options={SENTIMENT_OPTIONS}
          value={currentSentiment}
          onValueChange={(value) => setParam("sentiment", value)}
        />
      )}

      {/* Genre popover — only show if we have any genres */}
      {genres.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "filter-chip inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium",
                activeGenre
                  ? "border-primary/50 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {activeGenre?.name ?? "Genre"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="flex max-h-72 flex-col overflow-y-auto">
              <PopoverClose asChild>
                <button
                  type="button"
                  onClick={() => setParam("genre", "")}
                  className={cn(
                    "filter-menu-option rounded-md px-2 py-1.5 text-left text-xs",
                    !currentGenre
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  All genres
                </button>
              </PopoverClose>
              {genres.map((g) => {
                const active = String(g.id) === currentGenre;
                return (
                  <PopoverClose asChild key={g.id}>
                    <button
                      type="button"
                      onClick={() => setParam("genre", String(g.id))}
                      className={cn(
                        "filter-menu-option rounded-md px-2 py-1.5 text-left text-xs",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      {g.name}
                    </button>
                  </PopoverClose>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Year popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "filter-chip inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium",
              currentYear
                ? "border-primary/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {YEAR_OPTIONS.find((o) => o.value === currentYear)?.label ?? "Year"}
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          <div className="flex flex-col">
            {YEAR_OPTIONS.map((o) => {
              const active = o.value === currentYear;
              return (
                <PopoverClose asChild key={o.value || "any"}>
                  <button
                    type="button"
                    onClick={() => setParam("year", o.value)}
                    className={cn(
                      "filter-menu-option rounded-md px-2 py-1.5 text-left text-xs",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                </PopoverClose>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "filter-chip inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium",
              currentSort
                ? "border-primary/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sortOptions.find((o) => o.value === currentSort)?.label ?? "Sort"}
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col">
            {sortOptions.map((o) => {
              const active = o.value === currentSort;
              return (
                <PopoverClose asChild key={o.value || "default"}>
                  <button
                    type="button"
                    onClick={() => setParam("sort", o.value)}
                    className={cn(
                      "filter-menu-option rounded-md px-2 py-1.5 text-left text-xs",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                </PopoverClose>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {hasAny && (
        <button
          type="button"
          onClick={clearFilters}
          className="filter-chip inline-flex h-9 items-center gap-1 rounded-full px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
