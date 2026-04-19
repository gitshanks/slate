import { Suspense } from "react";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TmdbRailAsync } from "@/components/tmdb-rail-async";
import { FilteredGrid } from "@/components/filtered-grid";
import { Film } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";
import { fetchTitlesByStatus } from "@/lib/title-filters";
import {
  getTrending,
  getPopularMovies,
  getNowPlaying,
  getPopularTv,
  getRecommendedFromWatched,
} from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "slate — Watchlist",
};

export default async function WatchlistPage() {
  const [libResult, savedRowsRes] = await Promise.all([
    fetchTitlesByStatus("want"),
    supabase
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
        <p className="hidden text-xs text-muted-foreground sm:block">
          {allTitles.length} {allTitles.length === 1 ? "title" : "titles"}
        </p>
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
          <FilteredGrid allTitles={allTitles} status="want" />
        </Suspense>
      )}

      <TmdbRailAsync title="You might like" fetcher={getRecommendedFromWatched} savedTmdbIds={savedTmdbIds} />
      <TmdbRailAsync title="Trending this week" fetcher={getTrending} savedTmdbIds={savedTmdbIds} />
      <TmdbRailAsync title="Popular films" fetcher={getPopularMovies} savedTmdbIds={savedTmdbIds} />
      <TmdbRailAsync title="Now playing" fetcher={getNowPlaying} savedTmdbIds={savedTmdbIds} />
      <TmdbRailAsync title="Popular TV shows" fetcher={getPopularTv} savedTmdbIds={savedTmdbIds} />
    </div>
  );
}
