import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { WatchedStats } from "@/components/watched-stats";
import { Eye } from "lucide-react";
import { fetchTitlesByStatus } from "@/lib/title-filters";
import { formatImdbRating } from "@/lib/utils";

export const metadata: Metadata = {
  title: "slate — Watched",
};

export default async function WatchedPage() {
  const { titles: allTitles, allGenres, error } = await fetchTitlesByStatus("watched");

  if (error) {
    return (
      <EmptyState
        icon={<Eye className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  const imdbRated = allTitles.filter(
    (t) => t.imdb_rating != null && Number(t.imdb_rating) > 0
  );
  const imdbAvgRaw =
    imdbRated.length > 0
      ? imdbRated.reduce((s, t) => s + Number(t.imdb_rating), 0) /
        imdbRated.length
      : null;
  const imdbAvg = formatImdbRating(imdbAvgRaw);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Already seen
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Watched</h1>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>
            {allTitles.length} {allTitles.length === 1 ? "title" : "titles"}
          </div>
          {imdbAvg && <div className="font-mono">avg {imdbAvg} IMDB</div>}
        </div>
      </div>

      <WatchedStats titles={allTitles} />

      <FilterBar genres={allGenres} showSentiment />

      {allTitles.length === 0 ? (
        <EmptyState
          icon={<Eye className="h-6 w-6" />}
          title="Nothing watched yet"
          description="When you mark a title as watched it'll show up here."
        />
      ) : (
        <Suspense fallback={null}>
          <FilteredGrid allTitles={allTitles} status="watched" showSentiment />
        </Suspense>
      )}
    </div>
  );
}
