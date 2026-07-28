import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { FilteredGrid } from "@/components/filtered-grid";
import { Play } from "lucide-react";
import { fetchTitlesByStatus } from "@/lib/title-filters";

export const metadata: Metadata = {
  title: "slate · Watching",
};

export default async function WatchingPage() {
  const { titles: allTitles, allGenres, error } = await fetchTitlesByStatus("watching");

  if (error) {
    return (
      <EmptyState
        icon={<Play className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            In progress
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Watching now</h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {allTitles.length} {allTitles.length === 1 ? "title" : "titles"}
        </p>
      </div>

      <FilterBar genres={allGenres} />

      {allTitles.length === 0 ? (
        <EmptyState
          icon={<Play className="h-6 w-6" />}
          title="Nothing in progress"
          description="Mark a title as Watching from its detail page and it'll show up here."
        />
      ) : (
        <Suspense fallback={null}>
          <FilteredGrid allTitles={allTitles} status="watching" />
        </Suspense>
      )}
    </div>
  );
}
