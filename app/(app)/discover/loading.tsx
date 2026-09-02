import {
  LIBRARY_CONTENT_GUTTER_CLASS_NAME,
  LIBRARY_POSTER_RAIL_CLASS_NAME,
} from "@/components/poster-grid-geometry";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DISCOVER_RAILS = [
  "Based on your library",
  "Trending this week",
  "Now playing",
] as const;

function DiscoverRailLoading({ title }: { title: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h2>
      <div className="overflow-hidden pb-2">
        <div className={LIBRARY_POSTER_RAIL_CLASS_NAME}>
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="aspect-[2/3] w-full rounded-[1rem]" />
              <div className="mt-1.5 px-0.5 sm:mt-2.5">
                <Skeleton shape="text" className="h-2.5 w-4/5 sm:h-3" />
                <Skeleton
                  shape="text"
                  className="mt-0.5 h-2 w-2/5 sm:mt-1 sm:h-2.5"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Keep Discover's recognizable chrome in place while its personalized rails
 * stream. Skeletons already have a short entrance delay, so cached visits can
 * resolve without painting a placeholder while cold visits never flash blank.
 */
export default function DiscoverLoading() {
  return (
    <div
      aria-busy="true"
      className={cn(
        "pb-28 md:pb-8",
        LIBRARY_CONTENT_GUTTER_CLASS_NAME,
      )}
    >
      <span className="sr-only" role="status">
        Loading Discover
      </span>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Discover
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find what&rsquo;s next
        </h1>
      </header>

      {DISCOVER_RAILS.map((title) => (
        <DiscoverRailLoading key={title} title={title} />
      ))}
    </div>
  );
}
