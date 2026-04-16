"use client";

import { useSearchParams } from "next/navigation";
import { MediaGrid } from "@/components/media-grid";
import { filterAndSort } from "@/lib/filter-utils";
import type { TitleRow, TitleStatus } from "@/lib/types";

interface FilteredGridProps {
  allTitles: TitleRow[];
  status: TitleStatus;
  showSentiment?: boolean;
}

/**
 * Client component — reads URL search params and filters/sorts the full title
 * list in memory. Filter changes are instant: no server roundtrip, no skeleton.
 */
export function FilteredGrid({ allTitles, status, showSentiment }: FilteredGridProps) {
  const sp = useSearchParams();
  const params = {
    type: sp.get("type") ?? undefined,
    genre: sp.get("genre") ?? undefined,
    year: sp.get("year") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    sentiment: sp.get("sentiment") ?? undefined,
  };
  const titles = filterAndSort(allTitles, status, params);

  if (titles.length === 0 && allTitles.length > 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        No titles match the current filters.
      </p>
    );
  }

  return <MediaGrid titles={titles} showSentiment={showSentiment} />;
}
