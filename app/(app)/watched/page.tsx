import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { WatchedStats } from "@/components/watched-stats";
import { Eye } from "lucide-react";
import { fetchTitlesByStatus } from "@/lib/title-filters";

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

  return (
    <div>
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
          <FilteredGrid allTitles={allTitles} status="watched" />
        </Suspense>
      )}
    </div>
  );
}
