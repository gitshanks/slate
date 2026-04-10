import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Play } from "lucide-react";
import {
  fetchTitlesByStatus,
  type TitleFilterParams,
} from "@/lib/title-filters";

export const dynamic = "force-dynamic";

export default async function WatchingPage(props: PageProps<"/watching">) {
  const sp = (await props.searchParams) as TitleFilterParams;
  const { titles, allGenres, error } = await fetchTitlesByStatus("watching", sp);

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
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            In progress
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Watching now</h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {titles.length} {titles.length === 1 ? "title" : "titles"}
        </p>
      </div>

      <FilterBar genres={allGenres} />

      {titles.length === 0 ? (
        <EmptyState
          icon={<Play className="h-6 w-6" />}
          title="Nothing in progress"
          description="Mark a title as Watching from its detail page and it'll show up here."
        />
      ) : (
        <MediaGrid titles={titles} />
      )}
    </div>
  );
}
