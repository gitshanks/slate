import { TmdbRailAsync } from "@/components/tmdb-rail-async";
import { getLibraryClient } from "@/lib/library-db";
import {
  getNowPlaying,
  getRecommendedFromWatched,
  getTrending,
} from "@/lib/tmdb";

export async function DiscoverDefault() {
  const db = await getLibraryClient();
  const { data } = await db.from("titles").select("tmdb_id");
  const savedTmdbIds = new Set(
    ((data ?? []) as { tmdb_id: number }[]).map((title) => title.tmdb_id),
  );

  return (
    <div className="w-full pb-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Discover
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find what&rsquo;s next
        </h1>
      </header>

      <TmdbRailAsync
        title="You might like"
        fetcher={getRecommendedFromWatched}
        savedTmdbIds={savedTmdbIds}
        className="mt-8"
      />
      <TmdbRailAsync
        title="Trending this week"
        fetcher={getTrending}
        savedTmdbIds={savedTmdbIds}
      />
      <TmdbRailAsync
        title="Now playing"
        fetcher={getNowPlaying}
        savedTmdbIds={savedTmdbIds}
      />
    </div>
  );
}
