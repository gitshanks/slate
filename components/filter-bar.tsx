"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Film, Tv, LayoutGrid, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface FilterBarProps {
  /** Distinct genres found in the current result set. */
  genres: { id: number; name: string }[];
  /** Whether to show the "Newest release" sort option (hide if all items lack dates). */
  showYearSort?: boolean;
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

const SORT_OPTIONS = [
  { value: "", label: "Recently added" },
  { value: "rating", label: "Highest rated" },
  { value: "year", label: "Newest release" },
] as const;

export function FilterBar({ genres, showYearSort = true }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "";
  const currentGenre = searchParams.get("genre") ?? "";
  const currentYear = searchParams.get("year") ?? "";
  const currentSort = searchParams.get("sort") ?? "";

  const activeGenre = genres.find((g) => String(g.id) === currentGenre);

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const hasAny = currentType || currentGenre || currentYear || currentSort;

  const sortOptions = React.useMemo(
    () => (showYearSort ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value !== "year")),
    [showYearSort]
  );

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {/* Type segmented */}
      <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
        {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = currentType === value;
          return (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setParam("type", value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Genre popover — only show if we have any genres */}
      {genres.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors",
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
              <button
                type="button"
                onClick={() => setParam("genre", "")}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  !currentGenre
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                All genres
              </button>
              {genres.map((g) => {
                const active = String(g.id) === currentGenre;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setParam("genre", String(g.id))}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {g.name}
                  </button>
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
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors",
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
                <button
                  key={o.value || "any"}
                  type="button"
                  onClick={() => setParam("year", o.value)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
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
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors",
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
                <button
                  key={o.value || "default"}
                  type="button"
                  onClick={() => setParam("sort", o.value)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {hasAny && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
