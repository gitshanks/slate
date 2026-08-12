import { Suspense } from "react";
import type { Metadata } from "next";
import { getLibraryClient } from "@/lib/library-db";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TmdbRailAsync } from "@/components/tmdb-rail-async";
import { FilteredGrid } from "@/components/filtered-grid";
import { Film } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";
import { DiscoverJumpButton } from "@/components/discover-jump-button";
import { fetchTitlesByStatus } from "@/lib/title-filters";
import { getTrending, getNowPlaying, getRecommendedFromWatched } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "slate · Watchlist",
};

export default async function WatchlistPage() {
  const db = await getLibraryClient();
  const [libResult, savedRowsRes] = await Promise.all([
    fetchTitlesByStatus("want"),
    db
      .from("titles")
      .select("tmdb_id")
      .then(({ data }) => (data ?? []) as { tmdb_id: number }[]),
  ]);

  if (libResult.error) {
    return (
      <EmptyState
        icon={<Film className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={libResult.error.message}
      />
    );
  }

  const { titles: allTitles, allGenres } = libResult;
  const savedTmdbIds = new Set<number>(savedRowsRes.map((r) => r.tmdb_id));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Your watchlist
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Up next
          </h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {allTitles.length} {allTitles.length === 1 ? "title" : "titles"}
          </p>
          <DiscoverJumpButton />
        </div>
      </div>

      <FilterBar genres={allGenres} />

      {allTitles.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="Your watchlist is empty"
          description="Press ⌘K to search TMDB and add the first title you want to watch."
          action={<OpenPaletteHint />}
        />
      ) : (
        <Suspense fallback={null}>
          <FilteredGrid allTitles={allTitles} status="want" collapsible />
        </Suspense>
      )}

      {/* The compact library preview keeps discovery within immediate reach. */}
      <div
        id="discover"
        className="relative mt-12 scroll-mt-5 border-t border-border/60 pt-10 sm:mt-16 sm:scroll-mt-6 sm:pt-12 md:scroll-mt-24"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Discover
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Find what&rsquo;s next
        </h2>

        <TmdbRailAsync
          title="You might like"
          fetcher={getRecommendedFromWatched}
          savedTmdbIds={savedTmdbIds}
          className="mt-6"
        />
        <TmdbRailAsync title="Trending this week" fetcher={getTrending} savedTmdbIds={savedTmdbIds} />
        <TmdbRailAsync title="Now playing" fetcher={getNowPlaying} savedTmdbIds={savedTmdbIds} />
      </div>
    </div>
  );
}
