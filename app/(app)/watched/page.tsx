import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { WatchedStats } from "@/components/watched-stats";
import { Eye } from "lucide-react";
import {
  fetchTitlesByStatus,
  type TitleFilterParams,
} from "@/lib/title-filters";
import { formatTmdbScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WatchedPage(props: PageProps<"/watched">) {
  const sp = (await props.searchParams) as TitleFilterParams;
  const { titles, allGenres, error } = await fetchTitlesByStatus("watched", sp);

  if (error) {
    return (
      <EmptyState
        icon={<Eye className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  const tmdbRated = titles.filter(
    (t) => t.tmdb_rating != null && Number(t.tmdb_rating) > 0
  );
  const tmdbAvgRaw =
    tmdbRated.length > 0
      ? tmdbRated.reduce((s, t) => s + Number(t.tmdb_rating), 0) /
        tmdbRated.length
      : null;
  const tmdbAvg = formatTmdbScore(tmdbAvgRaw);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Already seen
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Watched</h1>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>
            {titles.length} {titles.length === 1 ? "title" : "titles"}
          </div>
          {tmdbAvg && <div className="font-mono">avg {tmdbAvg} TMDB</div>}
        </div>
      </div>

      <WatchedStats titles={titles} />

      <FilterBar genres={allGenres} showSentiment />

      {titles.length === 0 ? (
        <EmptyState
          icon={<Eye className="h-6 w-6" />}
          title="Nothing watched yet"
          description="When you mark a title as watched it'll show up here."
        />
      ) : (
        <MediaGrid titles={titles} showSentiment />
      )}
    </div>
  );
}
