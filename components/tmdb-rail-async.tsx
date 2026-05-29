import { Suspense } from "react";
import { TmdbRail } from "@/components/tmdb-rail";
import { Skeleton } from "@/components/ui/skeleton";
import type { TmdbSearchResult } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

function RailSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <section className={cn("mt-14", className)}>
      <p className="mb-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </p>
      <div>
        <div className="flex gap-3 overflow-hidden pb-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
              <Skeleton shape="text" className="mt-1.5 h-2.5 w-1/3" />
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
}

async function TmdbRailLoader({ title, fetcher, savedTmdbIds, className }: TmdbRailAsyncProps) {
  const items = await fetcher();
  return <TmdbRail title={title} items={items} savedTmdbIds={savedTmdbIds} className={className} />;
}

export function TmdbRailAsync(props: TmdbRailAsyncProps) {
  return (
    <Suspense fallback={<RailSkeleton title={props.title} className={props.className} />}>
      <TmdbRailLoader {...props} />
    </Suspense>
  );
}
