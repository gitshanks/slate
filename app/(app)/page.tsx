import {
  supabase,
  type TitleRow,
} from "@/lib/supabase";
import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { TmdbRail } from "@/components/tmdb-rail";
import { Film } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";
import {
  fetchTitlesByStatus,
  type TitleFilterParams,
} from "@/lib/title-filters";
import {
  getTrending,
  getPopularMovies,
  getNowPlaying,
  getPopularTv,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function WatchlistPage(props: PageProps<"/">) {
  const sp = (await props.searchParams) as TitleFilterParams;

  // Fetch library + all three TMDB catalogues + the full set of saved tmdb_ids
  // in parallel to avoid a waterfall.
  const [libResult, trending, popular, nowPlaying, popularTv, savedRowsRes] =
    await Promise.all([
      fetchTitlesByStatus("want", sp),
      getTrending(),
      getPopularMovies(),
      getNowPlaying(),
      getPopularTv(),
      supabase.from("titles").select("tmdb_id").then(
        ({ data }) => (data ?? []) as { tmdb_id: number }[]
      ),
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

  const titles = libResult.titles as TitleRow[];
  const savedTmdbIds = new Set<number>(savedRowsRes.map((r) => r.tmdb_id));

  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Your watchlist
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Up next
          </h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {titles.length} {titles.length === 1 ? "title" : "titles"}
        </p>
      </div>

      <FilterBar genres={libResult.allGenres} />

      {titles.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="Your watchlist is empty"
          description="Press ⌘K to search TMDB and add the first title you want to watch."
          action={<OpenPaletteHint />}
        />
      ) : (
        <MediaGrid titles={titles} />
      )}

      <TmdbRail title="Trending this week" items={trending} savedTmdbIds={savedTmdbIds} />
      <TmdbRail title="Popular films" items={popular} savedTmdbIds={savedTmdbIds} />
      <TmdbRail title="Now playing" items={nowPlaying} savedTmdbIds={savedTmdbIds} />
      <TmdbRail title="Popular TV shows" items={popularTv} savedTmdbIds={savedTmdbIds} />
    </div>
  );
}
