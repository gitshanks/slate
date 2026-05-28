import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { TmdbRailAsync } from "@/components/tmdb-rail-async";
import { RecommendationsSection } from "@/components/recommendations-section";
import { getTrending, getNowPlaying } from "@/lib/tmdb";

export const metadata: Metadata = {
  title: "slate — Discover",
};

// The browse surface, split out of the watchlist so the home page stays
// the user's library. Everything here is TMDB-sourced exploration.
export default async function DiscoverPage() {
  const savedRows = await supabase
    .from("titles")
    .select("tmdb_id")
    .then(({ data }) => (data ?? []) as { tmdb_id: number }[]);
  const savedTmdbIds = new Set<number>(savedRows.map((r) => r.tmdb_id));

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Discover
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">
          Find what's next
        </h1>
      </div>

      <RecommendationsSection
        title="You might like"
        subtitle="Based on the titles you've watched"
        savedTmdbIds={savedTmdbIds}
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
