import { TmdbRail } from "@/components/tmdb-rail";
import { LIBRARY_CONTENT_GUTTER_CLASS_NAME } from "@/components/poster-grid-geometry";
import { getLibraryClient } from "@/lib/library-db";
import { cn } from "@/lib/utils";
import {
  getNowPlaying,
  getRecommendedFromWatched,
  getTrending,
} from "@/lib/tmdb";

export async function DiscoverDefault() {
  const db = await getLibraryClient();
  const [{ data }, recommended, trending, nowPlaying] = await Promise.all([
    db.from("titles").select("tmdb_id"),
    getRecommendedFromWatched(),
    getTrending(),
    getNowPlaying(),
  ]);
  const savedTmdbIds = new Set(
    ((data ?? []) as { tmdb_id: number }[]).map((title) => title.tmdb_id),
  );

  return (
    <div
      className={cn(
        "pb-28 md:pb-8",
        LIBRARY_CONTENT_GUTTER_CLASS_NAME,
      )}
    >
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Discover
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find what&rsquo;s next
        </h1>
      </header>

      <TmdbRail
        title="Based on your library"
        items={recommended}
        savedTmdbIds={savedTmdbIds}
        className="mt-8"
        presentation="library"
      />
      <TmdbRail
        title="Trending this week"
        items={trending}
        savedTmdbIds={savedTmdbIds}
        className="mt-8"
        presentation="library"
      />
      <TmdbRail
        title="Now playing"
        items={nowPlaying}
        savedTmdbIds={savedTmdbIds}
        className="mt-8"
        presentation="library"
      />
    </div>
  );
}
