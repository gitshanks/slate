import { Suspense } from "react";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TmdbRailAsync } from "@/components/tmdb-rail-async";
import { RecommendationsSection } from "@/components/recommendations-section";
import { FilteredGrid } from "@/components/filtered-grid";
import { Film } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";
import { fetchTitlesByStatus } from "@/lib/title-filters";
import { getTrending, getNowPlaying } from "@/lib/tmdb";

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

      {/* The library ends here; the discovery rails pick up below. */}
      <div className="relative mt-20 border-t border-border/60 pt-12 sm:mt-24 sm:pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Discover
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Find what&rsquo;s next
        </h2>

        <RecommendationsSection
          title="You might like"
          subtitle="Based on the titles you've watched"
          savedTmdbIds={savedTmdbIds}
        />
        <TmdbRailAsync title="Trending this week" fetcher={getTrending} savedTmdbIds={savedTmdbIds} />
        <TmdbRailAsync title="Now playing" fetcher={getNowPlaying} savedTmdbIds={savedTmdbIds} />
      </div>
    </div>
  );
}
