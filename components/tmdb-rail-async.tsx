import { Suspense } from "react";
import { TmdbRail } from "@/components/tmdb-rail";
import { LIBRARY_POSTER_RAIL_CLASS_NAME } from "@/components/poster-grid-geometry";
import { Skeleton } from "@/components/ui/skeleton";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

function RailSkeleton({
  title,
  className,
  presentation,
}: {
  title: string;
  className?: string;
  presentation?: "default" | "library";
}) {
  return (
    <section className={cn("mt-14", className)}>
      <p className="mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </p>
      <div className="overflow-hidden pb-2">
        <div
          className={
            presentation === "library"
              ? LIBRARY_POSTER_RAIL_CLASS_NAME
              : "flex gap-3"
          }
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                presentation !== "library" &&
                  "w-[140px] shrink-0 sm:w-[160px]",
              )}
            >
              <Skeleton className="aspect-[2/3] w-full rounded-[1rem]" />
              <Skeleton shape="text" className="mt-1.5 h-2.5 w-4/5 sm:mt-2.5 sm:h-3" />
              <Skeleton shape="text" className="mt-1 h-2 w-2/5 sm:h-2.5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface TmdbRailAsyncProps {
  title: string;
  fetcher: () => Promise<TmdbSearchResult[]>;
  savedTmdbIds?: Set<number>;
  /** Passed through to the rail's <section> to tune top spacing. */
  className?: string;
  /** Match the Library shelf's compact card geometry. */
  presentation?: "default" | "library";
}

async function TmdbRailLoader({
  title,
  fetcher,
  savedTmdbIds,
  className,
  presentation,
}: TmdbRailAsyncProps) {
  const items = await fetcher();
  return (
    <TmdbRail
      title={title}
      items={items}
      savedTmdbIds={savedTmdbIds}
      className={className}
      presentation={presentation}
    />
  );
}

export function TmdbRailAsync(props: TmdbRailAsyncProps) {
  return (
    <Suspense
      fallback={
        <RailSkeleton
          title={props.title}
          className={props.className}
          presentation={props.presentation}
        />
      }
    >
      <TmdbRailLoader {...props} />
    </Suspense>
  );
}
