"use client";

import * as React from "react";
import { Film, Tv, LayoutGrid } from "lucide-react";
import { MediaGrid } from "@/components/media-grid";
import { MotionGrid, MotionItem } from "@/components/motion-grid";
import { TmdbTile } from "@/components/tmdb-tile";
import { PeopleGrid, type PersonTile } from "@/components/people-grid";
import { SegmentedFilter } from "@/components/segmented-filter";
import type { TitleRow } from "@/lib/types";
import type { TmdbMediaResult } from "@/lib/tmdb";

type TypeFilter = "" | "movie" | "tv";

const TYPE_OPTIONS = [
  { value: "", label: "All", icon: LayoutGrid },
  { value: "movie", label: "Films", icon: Film },
  { value: "tv", label: "Series", icon: Tv },
] as const;

const GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10";

const SECTION_HEADING =
  "mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl";

/**
 * Client wrapper for the search-results sections. The All / Films / Series
 * toggle filters in memory (local state, not the URL) so switching is instant
 * — no server roundtrip, no loading flash. People are a separate axis and
 * aren't affected by a media-type filter.
 */
export function SearchResults({
  library,
  media,
  people,
  savedTmdbIds,
}: {
  library: TitleRow[];
  media: TmdbMediaResult[];
  people: PersonTile[];
  savedTmdbIds: number[];
}) {
  const [type, setType] = React.useState<TypeFilter>("");
  const savedSet = React.useMemo(() => new Set(savedTmdbIds), [savedTmdbIds]);

  const filteredLibrary = type ? library.filter((t) => t.media_type === type) : library;
  const filteredMedia = type ? media.filter((m) => m.media_type === type) : media;

  const hasTitleResults = library.length > 0 || media.length > 0;
  const mediaHeading = type === "movie" ? "Films" : type === "tv" ? "Series" : "Movies & TV";
  const noneAfterFilter = filteredLibrary.length === 0 && filteredMedia.length === 0;

  return (
    <>
      {hasTitleResults && (
        <SegmentedFilter
          id="search-type-filter"
          options={TYPE_OPTIONS}
          value={type}
          onValueChange={(value) => setType(value as TypeFilter)}
          className="mb-8"
        />
      )}

      {filteredLibrary.length > 0 && (
        <section>
          <h2 className={SECTION_HEADING}>In your library</h2>
          <MediaGrid titles={filteredLibrary} />
        </section>
      )}

      {filteredMedia.length > 0 && (
        <section className={filteredLibrary.length > 0 ? "mt-12" : undefined}>
          <h2 className={SECTION_HEADING}>{mediaHeading}</h2>
          <MotionGrid className={GRID_CLASS}>
            {filteredMedia.map((item) => (
              <MotionItem key={`${item.media_type}-${item.id}`}>
                <TmdbTile
                  item={item}
                  variant="grid"
                  saved={savedSet.has(item.id)}
                />
              </MotionItem>
            ))}
          </MotionGrid>
        </section>
      )}

      {hasTitleResults && noneAfterFilter && (
        <p className="text-sm text-muted-foreground">
          No {type === "movie" ? "films" : "series"} in these results.
        </p>
      )}

      {people.length > 0 && <PeopleGrid title="People" people={people} />}
    </>
  );
}
