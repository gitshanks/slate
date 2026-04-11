import Link from "next/link";
import Image from "next/image";
import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { WatchedStats } from "@/components/watched-stats";
import { RailScroller } from "@/components/rail-scroller";
import { Eye, Heart } from "lucide-react";
import {
  fetchTitlesByStatus,
  type TitleFilterParams,
} from "@/lib/title-filters";
import { posterUrl } from "@/lib/tmdb-image";
import { formatTmdbScore, formatYear } from "@/lib/utils";

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

  const loved = titles.filter((t) => t.rating != null && Number(t.rating) === 3);

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

      {loved.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            <Heart className="h-3 w-3 text-rose-400" />
            Most loved
          </h2>
          <div className="-mr-4 sm:-mr-6 lg:-mr-10">
            <RailScroller>
              {loved.map((t) => {
                const poster = posterUrl(t.poster_path, "w342");
                const year = formatYear(t.release_date);
                const score = formatTmdbScore(t.tmdb_rating);
                return (
                  <Link
                    key={t.id}
                    href={`/title/${t.id}`}
                    prefetch
                    className="group block w-[140px] shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl sm:w-[160px]"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card hairline transition-all duration-200 ease-out hoverable:group-hover:-translate-y-1 hoverable:group-hover:shadow-[0_24px_60px_-20px_hsl(var(--primary)/0.35)]">
                      {poster ? (
                        <Image
                          src={poster}
                          alt={t.title}
                          fill
                          sizes="160px"
                          className="object-cover transition-transform duration-300 ease-out hoverable:group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                          {t.title}
                        </div>
                      )}
                      {score && (
                        <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[11px] font-mono font-medium text-white">
                          {score}
                        </div>
                      )}
                      <div className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-rose-500/90 p-1 text-white">
                        <Heart className="h-3 w-3 fill-white" />
                      </div>
                    </div>
                    <div className="mt-2 px-0.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {t.title}
                      </p>
                      {year && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {year}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </RailScroller>
          </div>
        </section>
      )}

      <FilterBar genres={allGenres} />

      {titles.length === 0 ? (
        <EmptyState
          icon={<Eye className="h-6 w-6" />}
          title="Nothing watched yet"
          description="When you mark a title as watched it'll show up here."
        />
      ) : (
        <MediaGrid titles={titles} />
      )}
    </div>
  );
}
